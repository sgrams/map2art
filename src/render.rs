use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fmt::Write as _;

use crate::overpass::{Bbox, Element, OverpassResponse};

fn path_length(pts: &[(f64, f64)]) -> f64 {
    let mut total = 0.0;
    let mut prev: Option<(f64, f64)> = None;
    for &p in pts {
        if let Some(q) = prev {
            total += ((p.0 - q.0).powi(2) + (p.1 - q.1).powi(2)).sqrt();
        }
        prev = Some(p);
    }
    total
}

fn label_font_size(width: f64, kind: &str) -> f64 {
    let frac = match kind {
        "motorway" | "trunk" => 0.012,
        "primary" => 0.011,
        "secondary" => 0.0095,
        "tertiary" => 0.0085,
        "residential" => 0.007,
        _ => 0.007,
    };
    frac * width
}

struct LayerInfo {
    layer: &'static str,
    subclass: String,
}

fn classify(tags: &HashMap<String, String>) -> Option<LayerInfo> {
    if let Some(v) = tags.get("highway") {
        return Some(LayerInfo {
            layer: "road",
            subclass: classify_highway(v),
        });
    }
    if let Some(v) = tags.get("railway") {
        return Some(LayerInfo {
            layer: "rail",
            subclass: format!("rail-{v}"),
        });
    }
    if tags.contains_key("building") {
        return Some(LayerInfo {
            layer: "building",
            subclass: "building".into(),
        });
    }
    let natural = tags.get("natural").map(String::as_str);
    if natural == Some("water") {
        return Some(LayerInfo {
            layer: "water",
            subclass: "water".into(),
        });
    }
    if natural == Some("coastline") {
        return Some(LayerInfo {
            layer: "coastline",
            subclass: "coastline".into(),
        });
    }
    if let Some(v) = tags.get("waterway") {
        return Some(LayerInfo {
            layer: "waterway",
            subclass: format!("waterway-{v}"),
        });
    }
    if let Some(v) = tags.get("landuse") {
        return Some(LayerInfo {
            layer: "landuse",
            subclass: format!("landuse-{v}"),
        });
    }
    if let Some(v) = tags.get("leisure") {
        return Some(LayerInfo {
            layer: "leisure",
            subclass: format!("leisure-{v}"),
        });
    }
    None
}

/// Layers whose closed ways should fill (areas). All other layers stroke their
/// polylines even when the way's first node equals its last — a closed road
/// loop (roundabout, plaza) must still render as a stroke, not a filled blob.
fn layer_is_filled(layer: &str) -> bool {
    matches!(layer, "building" | "water" | "landuse" | "leisure")
}

fn classify_highway(v: &str) -> String {
    let kind = match v {
        "motorway" | "motorway_link" => "motorway",
        "trunk" | "trunk_link" => "trunk",
        "primary" | "primary_link" => "primary",
        "secondary" | "secondary_link" => "secondary",
        "tertiary" | "tertiary_link" => "tertiary",
        "residential" | "unclassified" | "living_street" => "residential",
        "service" => "service",
        "pedestrian" | "footway" | "path" | "track" | "cycleway" | "steps" => "path",
        _ => "other",
    };
    format!("road-{kind}")
}

fn mercator(lon: f64, lat: f64) -> (f64, f64) {
    const R: f64 = 6_378_137.0;
    let x = R * lon.to_radians();
    let y = R * ((std::f64::consts::FRAC_PI_4 + lat.to_radians() / 2.0).tan()).ln();
    (x, y)
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Stitch a set of way node-id sequences into closed rings. A ring is
/// closed when its first and last node ids match. Ways are joined when
/// an endpoint of one matches an endpoint of another (reversing the
/// joined way when needed). Open chains are dropped.
fn stitch_rings(
    way_ids: &[i64],
    ways: &HashMap<i64, Vec<i64>>,
) -> Vec<Vec<i64>> {
    let mut remaining: Vec<Vec<i64>> = way_ids
        .iter()
        .filter_map(|id| ways.get(id).cloned())
        .filter(|w| w.len() >= 2)
        .collect();
    let mut rings: Vec<Vec<i64>> = Vec::new();

    while let Some(mut current) = remaining.pop() {
        loop {
            if current.len() >= 3 && current.first() == current.last() {
                rings.push(current);
                break;
            }
            let last = *current.last().unwrap();
            let mut joined = None;
            for (i, w) in remaining.iter().enumerate() {
                if *w.first().unwrap() == last {
                    joined = Some((i, false));
                    break;
                }
                if *w.last().unwrap() == last {
                    joined = Some((i, true));
                    break;
                }
            }
            match joined {
                Some((i, reverse)) => {
                    let mut w = remaining.remove(i);
                    if reverse {
                        w.reverse();
                    }
                    current.extend(w.into_iter().skip(1));
                }
                None => break, // open chain — drop
            }
        }
    }
    rings
}

/// Stitch ways into longer chains (open or closed). Used for coastlines:
/// adjacent way segments are joined where endpoints match, producing fewer
/// longer polylines instead of many disjoint segments.
fn stitch_chains(
    way_ids: &[i64],
    ways: &HashMap<i64, Vec<i64>>,
) -> Vec<Vec<i64>> {
    let mut remaining: Vec<Vec<i64>> = way_ids
        .iter()
        .filter_map(|id| ways.get(id).cloned())
        .filter(|w| w.len() >= 2)
        .collect();
    let mut chains: Vec<Vec<i64>> = Vec::new();

    while let Some(mut current) = remaining.pop() {
        // Extend at the tail.
        loop {
            if current.first() == current.last() && current.len() >= 3 {
                break; // already a closed loop
            }
            let last = *current.last().unwrap();
            let mut found: Option<(usize, bool)> = None;
            for (i, w) in remaining.iter().enumerate() {
                if *w.first().unwrap() == last {
                    found = Some((i, false));
                    break;
                }
                if *w.last().unwrap() == last {
                    found = Some((i, true));
                    break;
                }
            }
            match found {
                Some((i, reverse)) => {
                    let mut w = remaining.remove(i);
                    if reverse {
                        w.reverse();
                    }
                    current.extend(w.into_iter().skip(1));
                }
                None => break,
            }
        }
        // Extend at the head.
        loop {
            if current.first() == current.last() && current.len() >= 3 {
                break;
            }
            let first = *current.first().unwrap();
            let mut found: Option<(usize, bool)> = None;
            for (i, w) in remaining.iter().enumerate() {
                if *w.last().unwrap() == first {
                    found = Some((i, false));
                    break;
                }
                if *w.first().unwrap() == first {
                    found = Some((i, true));
                    break;
                }
            }
            match found {
                Some((i, reverse)) => {
                    let mut w = remaining.remove(i);
                    if reverse {
                        w.reverse();
                    }
                    // Prepend (skip the shared endpoint).
                    w.extend(current.iter().skip(1).copied());
                    current = w;
                }
                None => break,
            }
        }
        chains.push(current);
    }
    chains
}

const PLACE_SIZE_FRACTION: &[(&str, f64)] = &[
    ("city", 0.040),
    ("town", 0.022),
    ("village", 0.013),
    ("hamlet", 0.010),
    ("suburb", 0.011),
    ("neighbourhood", 0.009),
    ("quarter", 0.011),
    ("locality", 0.009),
];

fn place_size(width: f64, kind: &str) -> f64 {
    let frac = PLACE_SIZE_FRACTION
        .iter()
        .find(|(k, _)| *k == kind)
        .map(|(_, f)| *f)
        .unwrap_or(0.010);
    frac * width
}

/// Render order between places of different kinds: smaller places drawn
/// first, big ones (cities) last so they stack on top.
fn place_priority(kind: &str) -> i32 {
    match kind {
        "city" => 100,
        "town" => 80,
        "quarter" => 70,
        "suburb" => 60,
        "village" => 50,
        "neighbourhood" => 40,
        "hamlet" => 30,
        "locality" => 20,
        _ => 10,
    }
}

pub fn render_svg(
    data: &OverpassResponse,
    bbox: Bbox,
    canvas_width: f64,
    css: &str,
    shape: &str,
    labels: bool,
    hidden: &HashSet<String>,
) -> String {
    // ---- index ----
    let mut nodes: HashMap<i64, (f64, f64)> = HashMap::with_capacity(data.elements.len());
    let mut place_nodes: Vec<(f64, f64, String, String)> = Vec::new(); // (lon, lat, kind, name)
    let mut way_nodes: HashMap<i64, Vec<i64>> = HashMap::new();
    let mut way_tags: HashMap<i64, &HashMap<String, String>> = HashMap::new();

    for el in &data.elements {
        match el {
            Element::Node { id, lat, lon, tags } => {
                nodes.insert(*id, (*lon, *lat));
                if let (Some(kind), Some(name)) = (tags.get("place"), tags.get("name")) {
                    place_nodes.push((*lon, *lat, kind.clone(), name.clone()));
                }
            }
            Element::Way { id, nodes: refs, tags } => {
                way_nodes.insert(*id, refs.clone());
                way_tags.insert(*id, tags);
            }
            Element::Relation { .. } => {}
        }
    }

    // ---- multipolygons ----
    let mut consumed_ways: HashSet<i64> = HashSet::new();
    struct MultiPoly<'a> {
        info: LayerInfo,
        outer_rings: Vec<Vec<i64>>,
        inner_rings: Vec<Vec<i64>>,
        _tags: &'a HashMap<String, String>,
    }
    let mut multipolygons: Vec<MultiPoly> = Vec::new();

    for el in &data.elements {
        if let Element::Relation { members, tags } = el {
            if tags.get("type").map(String::as_str) != Some("multipolygon") {
                continue;
            }
            let Some(info) = classify(tags) else { continue };
            let mut outer_ids: Vec<i64> = Vec::new();
            let mut inner_ids: Vec<i64> = Vec::new();
            for m in members {
                if m.member_type != "way" {
                    continue;
                }
                match m.role.as_str() {
                    "inner" => inner_ids.push(m.ref_id),
                    _ => outer_ids.push(m.ref_id), // empty role defaults to outer
                }
                consumed_ways.insert(m.ref_id);
            }
            let outer_rings = stitch_rings(&outer_ids, &way_nodes);
            let inner_rings = stitch_rings(&inner_ids, &way_nodes);
            if outer_rings.is_empty() {
                continue;
            }
            multipolygons.push(MultiPoly {
                info,
                outer_rings,
                inner_rings,
                _tags: tags,
            });
        }
    }

    // ---- projection ----
    let (x_min, y_min) = mercator(bbox.west, bbox.south);
    let (x_max, y_max) = mercator(bbox.east, bbox.north);
    let dx = x_max - x_min;
    let dy = y_max - y_min;
    let width = canvas_width.max(1.0);
    let height = if dx > 0.0 { width * dy / dx } else { width };
    let sx = if dx > 0.0 { width / dx } else { 1.0 };
    let sy = if dy > 0.0 { height / dy } else { 1.0 };

    let project = |lon: f64, lat: f64| -> (f64, f64) {
        let (x, y) = mercator(lon, lat);
        ((x - x_min) * sx, (y_max - y) * sy)
    };

    let project_ring = |ring: &[i64]| -> Vec<(f64, f64)> {
        ring.iter()
            .filter_map(|id| nodes.get(id).copied())
            .map(|(lon, lat)| project(lon, lat))
            .collect()
    };

    // ---- bucket ways by layer (excluding multipolygon-consumed ones) ----
    let layer_order: &[&str] = &[
        "landuse",
        "leisure",
        "water",
        "waterway",
        "coastline",
        "building",
        "rail",
        "road",
    ];
    let mut way_by_layer: HashMap<&'static str, Vec<(String, Vec<(f64, f64)>, bool)>> =
        HashMap::new();
    let mut mp_by_layer: HashMap<&'static str, Vec<(String, Vec<Vec<(f64, f64)>>, Vec<Vec<(f64, f64)>>)>> =
        HashMap::new();

    struct NamedRoad {
        id: i64,
        name: String,
        road_kind: String,
        points: Vec<(f64, f64)>,
        length: f64,
    }
    let mut named_roads_by_name: HashMap<String, Vec<NamedRoad>> = HashMap::new();
    let mut coastline_way_ids: Vec<i64> = Vec::new();

    for el in &data.elements {
        if let Element::Way { id, nodes: refs, tags } = el {
            if consumed_ways.contains(id) {
                continue;
            }
            let Some(info) = classify(tags) else { continue };

            // Coastlines: defer to stitching so adjacent segments fuse into one
            // continuous polyline.
            if info.layer == "coastline" {
                coastline_way_ids.push(*id);
                continue;
            }

            let pts: Vec<(f64, f64)> = refs
                .iter()
                .filter_map(|nid| nodes.get(nid).copied())
                .map(|(lon, lat)| project(lon, lat))
                .collect();
            if pts.len() < 2 {
                continue;
            }
            let closed = refs.first() == refs.last() && refs.len() > 2;

            // Collect named-road segments for textPath labels.
            if info.layer == "road" {
                if let Some(name) = tags.get("name") {
                    let road_kind = info
                        .subclass
                        .strip_prefix("road-")
                        .unwrap_or("")
                        .to_string();
                    let length = path_length(&pts);
                    named_roads_by_name
                        .entry(name.clone())
                        .or_default()
                        .push(NamedRoad {
                            id: *id,
                            name: name.clone(),
                            road_kind,
                            points: pts.clone(),
                            length,
                        });
                }
            }

            way_by_layer
                .entry(info.layer)
                .or_default()
                .push((info.subclass, pts, closed));
        }
    }

    for mp in &multipolygons {
        let outer: Vec<Vec<(f64, f64)>> = mp.outer_rings.iter().map(|r| project_ring(r)).collect();
        let inner: Vec<Vec<(f64, f64)>> = mp.inner_rings.iter().map(|r| project_ring(r)).collect();
        mp_by_layer
            .entry(mp.info.layer)
            .or_default()
            .push((mp.info.subclass.clone(), outer, inner));
    }

    // Stitch coastline ways into longer polylines.
    if !coastline_way_ids.is_empty() {
        let chains = stitch_chains(&coastline_way_ids, &way_nodes);
        let bucket = way_by_layer.entry("coastline").or_default();
        for chain in chains {
            let pts: Vec<(f64, f64)> = chain
                .iter()
                .filter_map(|id| nodes.get(id).copied())
                .map(|(lon, lat)| project(lon, lat))
                .collect();
            if pts.len() < 2 {
                continue;
            }
            let closed = chain.first() == chain.last() && chain.len() >= 3;
            bucket.push(("coastline".to_string(), pts, closed));
        }
    }

    // ---- emit ----
    let mut out = String::new();
    write!(
        out,
        r#"<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.2} {h:.2}" width="{w:.2}" height="{h:.2}">
<style><![CDATA[
{css}
]]></style>
"#,
        w = width,
        h = height,
        css = css,
    )
    .unwrap();

    let is_circle = shape == "circle";
    if is_circle {
        let r = width.min(height) / 2.0;
        let cx = width / 2.0;
        let cy = height / 2.0;
        writeln!(
            out,
            r#"<defs><clipPath id="circle-clip"><circle cx="{cx:.2}" cy="{cy:.2}" r="{r:.2}"/></clipPath></defs>"#
        )
        .unwrap();
        writeln!(out, r#"<g clip-path="url(#circle-clip)">"#).unwrap();
    }
    writeln!(
        out,
        r#"<rect class="background" x="0" y="0" width="{w:.2}" height="{h:.2}"/>"#,
        w = width,
        h = height,
    )
    .unwrap();

    for layer in layer_order {
        if hidden.contains(*layer) {
            continue;
        }
        // Emit road casings just before the road layer so colored road strokes
        // overlay the casings.
        if *layer == "road" {
            if let Some(items) = way_by_layer.get("road") {
                writeln!(out, r#"<g class="layer layer-road-casings">"#).unwrap();
                for (subclass, pts, _closed) in items {
                    let mut pts_str = String::with_capacity(pts.len() * 14);
                    for (i, (x, y)) in pts.iter().enumerate() {
                        if i > 0 {
                            pts_str.push(' ');
                        }
                        let _ = write!(pts_str, "{x:.2},{y:.2}");
                    }
                    writeln!(
                        out,
                        r#"  <polyline class="{subclass}-casing" points="{pts_str}"/>"#
                    )
                    .unwrap();
                }
                writeln!(out, "</g>").unwrap();
            }
        }

        let ways = way_by_layer.get(*layer);
        let mps = mp_by_layer.get(*layer);
        if ways.is_none() && mps.is_none() {
            continue;
        }
        writeln!(out, r#"<g class="layer layer-{layer}">"#).unwrap();
        if let Some(items) = mps {
            for (subclass, outer, inner) in items {
                let mut d = String::new();
                for ring in outer.iter().chain(inner.iter()) {
                    if ring.is_empty() {
                        continue;
                    }
                    for (i, (x, y)) in ring.iter().enumerate() {
                        if i == 0 {
                            let _ = write!(d, "M{x:.2},{y:.2}");
                        } else {
                            let _ = write!(d, " L{x:.2},{y:.2}");
                        }
                    }
                    d.push_str(" Z ");
                }
                if !d.is_empty() {
                    writeln!(
                        out,
                        r#"  <path class="{subclass}" fill-rule="evenodd" d="{d}"/>"#
                    )
                    .unwrap();
                }
            }
        }
        if let Some(items) = ways {
            let filled = layer_is_filled(layer);
            for (subclass, pts, closed) in items {
                let mut pts_str = String::with_capacity(pts.len() * 14);
                for (i, (x, y)) in pts.iter().enumerate() {
                    if i > 0 {
                        pts_str.push(' ');
                    }
                    let _ = write!(pts_str, "{x:.2},{y:.2}");
                }
                let tag = if *closed && filled { "polygon" } else { "polyline" };
                writeln!(
                    out,
                    r#"  <{tag} class="{subclass}" points="{pts_str}"/>"#
                )
                .unwrap();
            }
        }
        writeln!(out, "</g>").unwrap();
    }

    // ---- labels (street + place) ----
    if labels {
        // Street labels via textPath — only if roads layer is visible.
        let road_labels_enabled = !hidden.contains("road");
        if road_labels_enabled {
        let labeled_kinds: &[&str] = &[
            "motorway",
            "trunk",
            "primary",
            "secondary",
            "tertiary",
            "residential",
        ];
        let mut road_labels: Vec<NamedRoad> = Vec::new();
        for (_, segments) in named_roads_by_name.drain() {
            let Some(best) = segments.into_iter().max_by(|a, b| {
                a.length.partial_cmp(&b.length).unwrap_or(Ordering::Equal)
            }) else {
                continue;
            };
            if !labeled_kinds.contains(&best.road_kind.as_str()) {
                continue;
            }
            let fs = label_font_size(width, &best.road_kind);
            let text_w = best.name.chars().count() as f64 * fs * 0.55;
            if best.length < text_w {
                continue;
            }
            road_labels.push(best);
        }
        if !road_labels.is_empty() {
            writeln!(out, r#"<g class="layer layer-road-labels">"#).unwrap();
            for label in &road_labels {
                let pts: Vec<(f64, f64)> = if label.points.first().unwrap().0
                    > label.points.last().unwrap().0
                {
                    label.points.iter().rev().copied().collect()
                } else {
                    label.points.clone()
                };
                let mut d = String::new();
                for (i, (x, y)) in pts.iter().enumerate() {
                    if i == 0 {
                        let _ = write!(d, "M{x:.2},{y:.2}");
                    } else {
                        let _ = write!(d, " L{x:.2},{y:.2}");
                    }
                }
                let fs = label_font_size(width, &label.road_kind);
                let path_id = format!("rl{}", label.id);
                let kind = &label.road_kind;
                let name = escape_xml(&label.name);
                writeln!(
                    out,
                    r#"  <path id="{path_id}" d="{d}" fill="none" stroke="none"/>"#
                )
                .unwrap();
                writeln!(
                    out,
                    r##"  <text class="road-label road-label-{kind}" font-size="{fs:.2}"><textPath href="#{path_id}" startOffset="50%" text-anchor="middle">{name}</textPath></text>"##
                )
                .unwrap();
            }
            writeln!(out, "</g>").unwrap();
        }
        }

        // Place labels.
        if !place_nodes.is_empty() {
            place_nodes.sort_by_key(|(_, _, kind, _)| place_priority(kind));
            writeln!(out, r#"<g class="layer layer-places">"#).unwrap();
            for (lon, lat, kind, name) in &place_nodes {
                if *lat < bbox.south
                    || *lat > bbox.north
                    || *lon < bbox.west
                    || *lon > bbox.east
                {
                    continue;
                }
                let (x, y) = project(*lon, *lat);
                let fs = place_size(width, kind);
                writeln!(
                    out,
                    r#"  <text class="place place-{kind}" x="{x:.2}" y="{y:.2}" font-size="{fs:.2}" text-anchor="middle">{name}</text>"#,
                    name = escape_xml(name),
                )
                .unwrap();
            }
            writeln!(out, "</g>").unwrap();
        }
    }

    if is_circle {
        writeln!(out, "</g>").unwrap();
    }
    out.push_str("</svg>\n");
    out
}
