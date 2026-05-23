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
        nodes: Vec<i64>,
        #[serde(default)]
        tags: HashMap<String, String>,
    },
    Relation {
        #[serde(default)]
        members: Vec<RelationMember>,
        #[serde(default)]
        tags: HashMap<String, String>,
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
    let b = format!(
        "{},{},{},{}",
        bbox.south, bbox.west, bbox.north, bbox.east
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
         );\n\
         out body;\n\
         >;\n\
         out skel qt;\n"
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
