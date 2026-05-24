// SPDX-FileCopyrightText: 2026 Stan Grams <sjg@haxx.space>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

mod overpass;
mod render;

use std::num::NonZeroUsize;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
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
        if let Some((inserted, data)) = cache.get(&key)
            && inserted.elapsed() < CACHE_TTL
        {
            return Ok(data.clone());
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
    /// Whether to emit street labels (textPath along road centerlines).
    #[serde(default)]
    street_labels: Option<bool>,
    /// Whether to emit place names (city / town / village / ...).
    #[serde(default)]
    place_labels: Option<bool>,
    /// Whether to emit named water-body labels.
    #[serde(default)]
    water_labels: Option<bool>,
    /// Backend layer names to omit from the render (e.g. "building", "rail",
    /// "water"). Empty = render everything.
    #[serde(default)]
    hidden: Option<Vec<String>>,
}

async fn post_render(state: web::Data<AppState>, body: web::Json<RenderRequest>) -> impl Responder {
    let bbox = Bbox {
        south: body.south,
        west: body.west,
        north: body.north,
        east: body.east,
    };
    if bbox.south >= bbox.north || bbox.west >= bbox.east {
        return HttpResponse::BadRequest().body("bbox must be ordered south<north, west<east");
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
    let street_labels = body.street_labels.unwrap_or(false);
    let place_labels = body.place_labels.unwrap_or(false);
    let water_labels = body.water_labels.unwrap_or(false);
    let hidden: std::collections::HashSet<String> = body
        .hidden
        .clone()
        .unwrap_or_default()
        .into_iter()
        .collect();
    let svg = render::render_svg(
        &data,
        bbox,
        render::RenderOptions {
            canvas_width: body.width.unwrap_or(2000.0),
            css: &css,
            shape,
            street_labels,
            place_labels,
            water_labels,
            hidden: &hidden,
        },
    );

    HttpResponse::Ok().content_type("image/svg+xml").body(svg)
}

#[derive(Deserialize)]
struct RasterRequest {
    /// Full composed SVG (outer canvas, overlays, frames — whatever the
    /// frontend wants to bake into the image).
    svg: String,
    /// Target raster width in pixels. Height is derived from the SVG's
    /// viewBox aspect ratio.
    width_px: u32,
    /// Target raster height in pixels.
    height_px: u32,
    /// Optional opaque fallback background. Painted before the SVG is drawn
    /// so the PNG never ends up transparent regardless of theme.
    #[serde(default)]
    background: Option<String>,
}

fn parse_hex_color(s: &str) -> Option<(u8, u8, u8)> {
    let s = s.trim();
    let s = s.strip_prefix('#')?;
    match s.len() {
        6 => {
            let r = u8::from_str_radix(&s[0..2], 16).ok()?;
            let g = u8::from_str_radix(&s[2..4], 16).ok()?;
            let b = u8::from_str_radix(&s[4..6], 16).ok()?;
            Some((r, g, b))
        }
        3 => {
            let r = u8::from_str_radix(&s[0..1], 16).ok()? * 17;
            let g = u8::from_str_radix(&s[1..2], 16).ok()? * 17;
            let b = u8::from_str_radix(&s[2..3], 16).ok()? * 17;
            Some((r, g, b))
        }
        _ => None,
    }
}

/// System-font database, built once and shared across raster requests.
///
/// `usvg::Options::default()` ships an empty font database; with no fonts,
/// resvg cannot shape any `<text>` and silently omits it from the output. We
/// load the system fonts once (it's comparatively slow) behind a `OnceLock`
/// and clone the `Arc` into each request's options.
fn shared_fontdb() -> Arc<resvg::usvg::fontdb::Database> {
    static FONTDB: OnceLock<Arc<resvg::usvg::fontdb::Database>> = OnceLock::new();
    FONTDB
        .get_or_init(|| {
            let mut db = resvg::usvg::fontdb::Database::new();
            db.load_system_fonts();
            info!("loaded {} font faces for PNG rasterization", db.len());
            Arc::new(db)
        })
        .clone()
}

/// Rasterize the composed SVG with resvg and return a PNG. This runs on the
/// backend specifically because Firefox (and to a lesser extent other
/// browsers) drops CSS rules during `<img>`-based SVG rasterization, which
/// the client-side downloadPng path used. A pure-Rust SVG renderer doesn't
/// care about any of that.
async fn post_raster(body: web::Json<RasterRequest>) -> impl Responder {
    let RasterRequest {
        svg,
        width_px,
        height_px,
        background,
    } = body.into_inner();
    if width_px == 0 || height_px == 0 || width_px > 16384 || height_px > 16384 {
        return HttpResponse::BadRequest().body("width/height must be in 1..=16384");
    }
    // Without a populated font database resvg silently drops every <text>
    // node (POI labels, text overlays, the attribution, water/scale labels),
    // so the PNG would show shapes but no text. Share one system-font db.
    let opt = resvg::usvg::Options {
        fontdb: shared_fontdb(),
        ..Default::default()
    };
    let tree = match resvg::usvg::Tree::from_str(&svg, &opt) {
        Ok(t) => t,
        Err(e) => {
            error!("resvg parse failed: {e}");
            return HttpResponse::BadRequest().body(format!("svg parse error: {e}"));
        }
    };
    let svg_size = tree.size();
    let sx = width_px as f32 / svg_size.width();
    let sy = height_px as f32 / svg_size.height();
    let mut pixmap = match resvg::tiny_skia::Pixmap::new(width_px, height_px) {
        Some(p) => p,
        None => {
            return HttpResponse::InternalServerError().body("pixmap alloc failed");
        }
    };
    // Pre-fill with the requested background so any transparent areas left by
    // the SVG (e.g. font-loading gaps) end up opaque in the PNG.
    if let Some((r, g, b)) = background.as_deref().and_then(parse_hex_color) {
        pixmap.fill(resvg::tiny_skia::Color::from_rgba8(r, g, b, 255));
    } else {
        pixmap.fill(resvg::tiny_skia::Color::from_rgba8(0xfa, 0xfa, 0xfa, 255));
    }
    let transform = resvg::tiny_skia::Transform::from_scale(sx, sy);
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    let bytes = match pixmap.encode_png() {
        Ok(b) => b,
        Err(e) => {
            error!("png encode failed: {e}");
            return HttpResponse::InternalServerError().body(format!("png encode error: {e}"));
        }
    };
    HttpResponse::Ok().content_type("image/png").body(bytes)
}

async fn get_style(state: web::Data<AppState>) -> impl Responder {
    let css = state.styles.read().await.clone();
    HttpResponse::Ok().content_type("text/css").body(css)
}

#[derive(Deserialize)]
struct PutStyle {
    css: String,
}

async fn put_style(state: web::Data<AppState>, body: web::Json<PutStyle>) -> impl Responder {
    {
        let mut guard = state.styles.write().await;
        *guard = body.css.clone();
    }
    if let Err(e) = tokio::fs::write(&state.styles_path, &body.css).await {
        error!("failed to persist styles: {e}");
        return HttpResponse::InternalServerError().body(format!("write failed: {e}"));
    }
    HttpResponse::NoContent().finish()
}

async fn list_themes(state: web::Data<AppState>) -> impl Responder {
    let mut names = Vec::new();
    if let Ok(mut entries) = tokio::fs::read_dir(&state.themes_dir).await {
        while let Ok(Some(e)) = entries.next_entry().await {
            if let Some(name) = e.file_name().to_str()
                && let Some(stem) = name.strip_suffix(".css")
            {
                names.push(stem.to_string());
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

async fn get_theme(state: web::Data<AppState>, path: web::Path<String>) -> impl Responder {
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

    // Warm the system-font database off the reactor so the first PNG export
    // doesn't pay for the font scan.
    tokio::task::spawn_blocking(shared_fontdb).await.ok();

    let bind = args.bind.clone();
    info!("listening on http://{bind}");

    HttpServer::new(move || {
        App::new()
            .app_data(state.clone())
            // Composed map SVGs can be several MB on dense bboxes — bump the
            // JSON body limit from the actix default (32 KB) so /api/raster
            // can accept them.
            .app_data(web::JsonConfig::default().limit(64 * 1024 * 1024))
            .wrap(middleware::Logger::default())
            .wrap(Cors::permissive())
            .route("/api/render", web::post().to(post_render))
            .route("/api/raster", web::post().to(post_raster))
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
