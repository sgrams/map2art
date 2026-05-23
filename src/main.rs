mod overpass;
mod render;

use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use actix_cors::Cors;
use actix_web::{App, HttpResponse, HttpServer, Responder, middleware, web};
use anyhow::Result;
use clap::Parser;
use lru::LruCache;
use serde::Deserialize;
use tokio::sync::RwLock;
use tracing::{error, info};

use crate::overpass::{Bbox, OverpassResponse};

const CACHE_TTL: Duration = Duration::from_secs(3600);
const CACHE_CAPACITY: usize = 32;

#[derive(Hash, Eq, PartialEq, Clone, Copy)]
struct BboxKey([i64; 4]);

fn bbox_key(b: Bbox) -> BboxKey {
    let r = |v: f64| (v * 1e6).round() as i64;
    BboxKey([r(b.south), r(b.west), r(b.north), r(b.east)])
}

type OverpassCache = Mutex<LruCache<BboxKey, (Instant, Arc<OverpassResponse>)>>;

#[derive(Parser, Debug)]
#[command(version, about = "OpenStreetMap → SVG art map generator")]
struct Args {
    /// Address to bind the HTTP server.
    #[arg(long, default_value = "127.0.0.1:8080")]
    bind: String,

    /// Path to the editable working stylesheet.
    #[arg(long, default_value = "styles.css")]
    styles: PathBuf,

    /// Directory containing read-only theme presets.
    #[arg(long, default_value = "themes")]
    themes: PathBuf,

    /// Overpass API endpoint.
    #[arg(long, default_value = "https://overpass-api.de/api/interpreter")]
    overpass_url: String,
}

struct AppState {
    http: reqwest::Client,
    overpass_url: String,
    styles_path: PathBuf,
    themes_dir: PathBuf,
    styles: RwLock<String>,
    cache: OverpassCache,
}

async fn fetch_cached(state: &AppState, bbox: Bbox) -> anyhow::Result<Arc<OverpassResponse>> {
    let key = bbox_key(bbox);
    {
        let mut cache = state.cache.lock().unwrap();
        if let Some((inserted, data)) = cache.get(&key) {
            if inserted.elapsed() < CACHE_TTL {
                return Ok(data.clone());
            }
        }
    }
    let data = Arc::new(overpass::fetch(&state.http, &state.overpass_url, bbox).await?);
    let mut cache = state.cache.lock().unwrap();
    cache.put(key, (Instant::now(), data.clone()));
    Ok(data)
}

#[derive(Deserialize)]
struct RenderRequest {
    south: f64,
    west: f64,
    north: f64,
    east: f64,
    #[serde(default)]
    width: Option<f64>,
    /// Optional CSS override for live preview; if absent the server uses the
    /// persisted stylesheet.
    #[serde(default)]
    css: Option<String>,
    /// "rect" (default) or "circle" — circle clips the render to an inscribed
    /// circle on a square bbox.
    #[serde(default)]
    shape: Option<String>,
    /// Whether to emit place names and street-name labels.
    #[serde(default)]
    labels: Option<bool>,
    /// Backend layer names to omit from the render (e.g. "building", "rail",
    /// "water"). Empty = render everything.
    #[serde(default)]
    hidden: Option<Vec<String>>,
}

async fn post_render(
    state: web::Data<AppState>,
    body: web::Json<RenderRequest>,
) -> impl Responder {
    let bbox = Bbox {
        south: body.south,
        west: body.west,
        north: body.north,
        east: body.east,
    };
    if bbox.south >= bbox.north || bbox.west >= bbox.east {
        return HttpResponse::BadRequest()
            .body("bbox must be ordered south<north, west<east");
    }

    let data = match fetch_cached(&state, bbox).await {
        Ok(d) => d,
        Err(e) => {
            error!("overpass fetch failed: {e:?}");
            return HttpResponse::BadGateway().body(format!("overpass error: {e}"));
        }
    };

    let css: String = if let Some(c) = &body.css {
        c.clone()
    } else {
        state.styles.read().await.clone()
    };
    let shape = body.shape.as_deref().unwrap_or("rect");
    let labels = body.labels.unwrap_or(false);
    let hidden: std::collections::HashSet<String> = body
        .hidden
        .clone()
        .unwrap_or_default()
        .into_iter()
        .collect();
    let svg = render::render_svg(
        &data,
        bbox,
        body.width.unwrap_or(2000.0),
        &css,
        shape,
        labels,
        &hidden,
    );

    HttpResponse::Ok()
        .content_type("image/svg+xml")
        .body(svg)
}

async fn get_style(state: web::Data<AppState>) -> impl Responder {
    let css = state.styles.read().await.clone();
    HttpResponse::Ok().content_type("text/css").body(css)
}

#[derive(Deserialize)]
struct PutStyle {
    css: String,
}

async fn put_style(
    state: web::Data<AppState>,
    body: web::Json<PutStyle>,
) -> impl Responder {
    {
        let mut guard = state.styles.write().await;
        *guard = body.css.clone();
    }
    if let Err(e) = tokio::fs::write(&state.styles_path, &body.css).await {
        error!("failed to persist styles: {e}");
        return HttpResponse::InternalServerError()
            .body(format!("write failed: {e}"));
    }
    HttpResponse::NoContent().finish()
}

async fn list_themes(state: web::Data<AppState>) -> impl Responder {
    let mut names = Vec::new();
    if let Ok(mut entries) = tokio::fs::read_dir(&state.themes_dir).await {
        while let Ok(Some(e)) = entries.next_entry().await {
            if let Some(name) = e.file_name().to_str() {
                if let Some(stem) = name.strip_suffix(".css") {
                    names.push(stem.to_string());
                }
            }
        }
    }
    names.sort();
    HttpResponse::Ok().json(names)
}

fn safe_theme_path(themes_dir: &Path, name: &str) -> Option<PathBuf> {
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    Some(themes_dir.join(format!("{name}.css")))
}

async fn get_theme(
    state: web::Data<AppState>,
    path: web::Path<String>,
) -> impl Responder {
    let name = path.into_inner();
    let Some(p) = safe_theme_path(&state.themes_dir, &name) else {
        return HttpResponse::BadRequest().body("invalid theme name");
    };
    match tokio::fs::read_to_string(&p).await {
        Ok(s) => HttpResponse::Ok().content_type("text/css").body(s),
        Err(_) => HttpResponse::NotFound().body("theme not found"),
    }
}

const DEFAULT_THEME: &str = include_str!("../themes/pastel.css");

#[actix_web::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let args = Args::parse();

    let styles = match tokio::fs::read_to_string(&args.styles).await {
        Ok(s) => s,
        Err(_) => {
            tokio::fs::write(&args.styles, DEFAULT_THEME).await?;
            DEFAULT_THEME.to_string()
        }
    };

    let http = reqwest::Client::builder()
        .user_agent("map2art/0.1")
        .timeout(Duration::from_secs(120))
        .build()?;

    let state = web::Data::new(AppState {
        http,
        overpass_url: args.overpass_url.clone(),
        styles_path: args.styles.clone(),
        themes_dir: args.themes.clone(),
        styles: RwLock::new(styles),
        cache: Mutex::new(LruCache::new(NonZeroUsize::new(CACHE_CAPACITY).unwrap())),
    });

    let bind = args.bind.clone();
    info!("listening on http://{bind}");

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            .wrap(middleware::Logger::default())
            .wrap(Cors::permissive())
            .route("/api/render", web::post().to(post_render))
            .route("/api/style", web::get().to(get_style))
            .route("/api/style", web::put().to(put_style))
            .route("/api/themes", web::get().to(list_themes))
            .route("/api/themes/{name}", web::get().to(get_theme))
            .route(
                "/health",
                web::get().to(|| async { HttpResponse::Ok().body("ok") }),
            )
    })
    .bind(&bind)?
    .run()
    .await?;

    Ok(())
}
