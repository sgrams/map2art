// SPDX-FileCopyrightText: 2026 Stan Grams <sjg@haxx.space>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

use std::collections::HashMap;

use serde::Deserialize;

#[derive(Debug, Clone, Copy)]
pub struct Bbox {
    pub south: f64,
    pub west: f64,
    pub north: f64,
    pub east: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OverpassResponse {
    pub elements: Vec<Element>,
}

/// Bounding-box centre emitted by Overpass `out center` (used to anchor a label
/// on a way/relation whose full geometry we deliberately don't fetch).
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct Center {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Element {
    Node {
        id: i64,
        lat: f64,
        lon: f64,
        #[serde(default)]
        tags: HashMap<String, String>,
    },
    Way {
        id: i64,
        // Absent when fetched via `out tags center` (sea/bay name areas).
        #[serde(default)]
        nodes: Vec<i64>,
        #[serde(default)]
        tags: HashMap<String, String>,
        #[serde(default)]
        center: Option<Center>,
    },
    Relation {
        #[serde(default)]
        members: Vec<RelationMember>,
        #[serde(default)]
        tags: HashMap<String, String>,
        #[serde(default)]
        center: Option<Center>,
    },
}

#[derive(Debug, Clone, Deserialize)]
pub struct RelationMember {
    #[serde(rename = "type")]
    pub member_type: String,
    #[serde(rename = "ref")]
    pub ref_id: i64,
    #[serde(default)]
    pub role: String,
}

pub fn build_query(bbox: Bbox) -> String {
    let b = format!("{},{},{},{}", bbox.south, bbox.west, bbox.north, bbox.east);
    // Seas / oceans / bays / gulfs are named by features placed at the body's
    // centre — often a node, sometimes an area (natural=bay way/relation) — well
    // outside a small coastal view. Pull those names from a wider area (grown by
    // the view span, min ~1°) so the body can still be labelled; the renderer
    // clamps the anchor into the view.
    let gw = (bbox.east - bbox.west).abs().max(1.0);
    let gh = (bbox.north - bbox.south).abs().max(1.0);
    let eb = format!(
        "{},{},{},{}",
        bbox.south - gh,
        bbox.west - gw,
        bbox.north + gh,
        bbox.east + gw
    );
    format!(
        "[out:json][timeout:60];\n\
         (\n\
           way[\"highway\"]({b});\n\
           way[\"railway\"]({b});\n\
           way[\"waterway\"]({b});\n\
           way[\"natural\"=\"water\"]({b});\n\
           way[\"natural\"=\"coastline\"]({b});\n\
           way[\"landuse\"]({b});\n\
           way[\"leisure\"]({b});\n\
           way[\"building\"]({b});\n\
           relation[\"type\"=\"multipolygon\"][\"natural\"=\"water\"]({b});\n\
           relation[\"type\"=\"multipolygon\"][\"landuse\"]({b});\n\
           relation[\"type\"=\"multipolygon\"][\"leisure\"]({b});\n\
           relation[\"type\"=\"multipolygon\"][\"building\"]({b});\n\
           node[\"place\"]({b});\n\
           node[\"place\"~\"^(sea|ocean|strait)$\"]({eb});\n\
           node[\"natural\"~\"^(bay|strait)$\"]({eb});\n\
         );\n\
         out body;\n\
         >;\n\
         out skel qt;\n\
         /* Sea / bay name *areas* (centre only — no geometry recursion, so the\n\
            request stays light and reliable). */\n\
         (\n\
           way[\"natural\"~\"^(bay|strait)$\"]({eb});\n\
           relation[\"natural\"~\"^(bay|strait)$\"]({eb});\n\
         );\n\
         out tags center;\n"
    )
}

pub async fn fetch(
    client: &reqwest::Client,
    url: &str,
    bbox: Bbox,
) -> anyhow::Result<OverpassResponse> {
    let query = build_query(bbox);
    let resp = client.post(url).body(query).send().await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("overpass returned {status}: {body}");
    }
    let data: OverpassResponse = resp.json().await?;
    Ok(data)
}
