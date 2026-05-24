// SPDX-FileCopyrightText: 2026 Stan Grams <sjg@haxx.space>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

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
fn stitch_rings(way_ids: &[i64], ways: &HashMap<i64, Vec<i64>>) -> Vec<Vec<i64>> {
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
fn stitch_chains(way_ids: &[i64], ways: &HashMap<i64, Vec<i64>>) -> Vec<Vec<i64>> {
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

/// Stitch coastline ways **preserving direction** — never reversing a segment —
/// so OSM's winding survives (the sea is on the right of a coastline way in
/// geographic space). `stitch_chains` reverses freely to join, which loses it.
fn stitch_coastline_directed(way_ids: &[i64], ways: &HashMap<i64, Vec<i64>>) -> Vec<Vec<i64>> {
    let mut remaining: Vec<Vec<i64>> = way_ids
        .iter()
        .filter_map(|id| ways.get(id).cloned())
        .filter(|w| w.len() >= 2)
        .collect();
    let mut chains: Vec<Vec<i64>> = Vec::new();
    while let Some(mut current) = remaining.pop() {
        loop {
            if current.first() == current.last() && current.len() >= 3 {
                break;
            }
            let last = *current.last().unwrap();
            match remaining.iter().position(|w| *w.first().unwrap() == last) {
                Some(i) => {
                    let w = remaining.remove(i);
                    current.extend(w.into_iter().skip(1));
                }
                None => break,
            }
        }
        loop {
            if current.first() == current.last() && current.len() >= 3 {
                break;
            }
            let first = *current.first().unwrap();
            match remaining.iter().position(|w| *w.last().unwrap() == first) {
                Some(i) => {
                    let mut w = remaining.remove(i);
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

/// Position of a point on the viewport rectangle's perimeter as a parameter in
/// [0,4): top edge 0–1, right 1–2, bottom 2–3, left 3–4 (clockwise on screen).
fn boundary_param(p: (f64, f64), w: f64, h: f64) -> f64 {
    let (x, y) = p;
    // Snap to the nearest edge.
    let d_top = y;
    let d_bottom = h - y;
    let d_left = x;
    let d_right = w - x;
    let m = d_top.min(d_bottom).min(d_left).min(d_right);
    if m == d_top {
        (x / w).clamp(0.0, 1.0)
    } else if m == d_right {
        1.0 + (y / h).clamp(0.0, 1.0)
    } else if m == d_bottom {
        2.0 + (1.0 - (x / w).clamp(0.0, 1.0))
    } else {
        3.0 + (1.0 - (y / h).clamp(0.0, 1.0))
    }
}

/// Point on the perimeter at parameter t in [0,4).
fn boundary_point(t: f64, w: f64, h: f64) -> (f64, f64) {
    let t = t.rem_euclid(4.0);
    if t < 1.0 {
        (t * w, 0.0)
    } else if t < 2.0 {
        (w, (t - 1.0) * h)
    } else if t < 3.0 {
        ((3.0 - t) * w, h)
    } else {
        (0.0, (4.0 - t) * h)
    }
}

/// The rect corners between params a and b walking in +t (their params:
/// 1=TR, 2=BR, 3=BL, 4/0=TL).
fn corners_between(a: f64, b: f64, w: f64, h: f64) -> Vec<(f64, f64)> {
    let mut out = Vec::new();
    let mut k = a.floor() + 1.0;
    while k < b {
        out.push(boundary_point(k, w, h));
        k += 1.0;
    }
    out
}

/// Inside portion of a segment after clipping to the viewport rectangle.
struct ClipSeg {
    a: (f64, f64), // entry point (at t-entry along the original segment)
    b: (f64, f64), // exit point (at t-exit)
    t0: f64,
    t1: f64,
}

/// Liang–Barsky: clip segment p→q to [0,w]×[0,h]. None if fully outside.
fn liang_barsky(p: (f64, f64), q: (f64, f64), w: f64, h: f64) -> Option<ClipSeg> {
    let (dx, dy) = (q.0 - p.0, q.1 - p.1);
    let (mut t0, mut t1) = (0.0_f64, 1.0_f64);
    let edges = [(-dx, p.0), (dx, w - p.0), (-dy, p.1), (dy, h - p.1)];
    for (pp, qq) in edges {
        if pp.abs() < 1e-12 {
            if qq < 0.0 {
                return None; // parallel and outside
            }
        } else {
            let r = qq / pp;
            if pp < 0.0 {
                if r > t1 {
                    return None;
                }
                if r > t0 {
                    t0 = r;
                }
            } else {
                if r < t0 {
                    return None;
                }
                if r < t1 {
                    t1 = r;
                }
            }
        }
    }
    if t0 > t1 {
        return None;
    }
    Some(ClipSeg {
        a: (p.0 + t0 * dx, p.1 + t0 * dy),
        b: (p.0 + t1 * dx, p.1 + t1 * dy),
        t0,
        t1,
    })
}

/// Clip a directed polyline to the rect, returning the maximal runs that lie
/// inside, each beginning and ending **on the boundary**. Runs that begin or
/// end at the chain's own interior endpoint (coastline data ending inside the
/// view) are dropped — they can't be closed confidently.
fn clip_runs(chain: &[(f64, f64)], w: f64, h: f64) -> Vec<Vec<(f64, f64)>> {
    let eps = 1e-6;
    let mut runs: Vec<Vec<(f64, f64)>> = Vec::new();
    let mut cur: Vec<(f64, f64)> = Vec::new();
    let mut start_on_boundary = false;
    for seg in chain.windows(2) {
        let Some(ClipSeg { a, b, t0, t1 }) = liang_barsky(seg[0], seg[1], w, h) else {
            // Segment fully outside — close any open run at its last boundary pt.
            if !cur.is_empty() {
                if start_on_boundary {
                    runs.push(std::mem::take(&mut cur));
                } else {
                    cur.clear();
                }
            }
            continue;
        };
        let entered = t0 > eps; // a is a boundary crossing (seg[0] was outside)
        let exited = t1 < 1.0 - eps; // b is a boundary crossing (seg[1] outside)
        if cur.is_empty() {
            cur.push(a);
            start_on_boundary = entered;
        } else {
            let last = *cur.last().unwrap();
            if (last.0 - a.0).abs() > eps || (last.1 - a.1).abs() > eps {
                // Re-entered after a gap; close the previous run, begin anew.
                if start_on_boundary {
                    runs.push(std::mem::take(&mut cur));
                } else {
                    cur.clear();
                }
                cur.push(a);
                start_on_boundary = entered;
            }
        }
        cur.push(b);
        if exited {
            if start_on_boundary {
                runs.push(std::mem::take(&mut cur));
            } else {
                cur.clear();
            }
            start_on_boundary = false;
        }
    }
    runs
}

/// Build an SVG path `d` filling the **sea** within a w×h viewport from
/// direction-preserving coastline `chains` (canvas coords). Returns "" when it
/// can't assemble a confident, well-formed result, so nothing is filled rather
/// than risking filling land. The map clip trims the path to the viewport.
fn sea_fill_path(chains: &[Vec<(f64, f64)>], w: f64, h: f64) -> String {
    // Sea is on the LEFT of coastline travel in canvas coords (geographic
    // water-on-right flips under the Y-down projection). The +t perimeter walk
    // below encloses the RIGHT of travel, so reverse each chain first to flip
    // the enclosed side onto the sea. (Pinned by sea_tests::sea_fills_left.)
    let mut runs: Vec<Vec<(f64, f64)>> = Vec::new();
    for c in chains {
        let rev: Vec<(f64, f64)> = c.iter().rev().copied().collect();
        runs.extend(clip_runs(&rev, w, h));
    }
    if runs.is_empty() {
        return String::new();
    }
    // Pair each run's exit to the next run's entry by walking the perimeter in
    // +t; the corners in between become part of the sea polygon edge.
    let n = runs.len();
    let entry_t: Vec<f64> = runs.iter().map(|r| boundary_param(r[0], w, h)).collect();
    let exit_t: Vec<f64> = runs
        .iter()
        .map(|r| boundary_param(*r.last().unwrap(), w, h))
        .collect();
    let mut used = vec![false; n];
    let mut d = String::new();
    for start in 0..n {
        if used[start] {
            continue;
        }
        let mut loop_pts: Vec<(f64, f64)> = Vec::new();
        let mut cur = start;
        let mut guard = 0;
        loop {
            used[cur] = true;
            loop_pts.extend_from_slice(&runs[cur]);
            // From this run's exit, find the next run whose entry is the first
            // encountered walking +t around the perimeter.
            let from = exit_t[cur];
            let mut next = usize::MAX;
            let mut best = f64::INFINITY;
            for (j, &et) in entry_t.iter().enumerate() {
                let mut delta = et - from;
                if delta <= 1e-9 {
                    delta += 4.0;
                }
                if delta < best {
                    best = delta;
                    next = j;
                }
            }
            if next == usize::MAX {
                break;
            }
            for c in corners_between(from, from + best, w, h) {
                loop_pts.push(c);
            }
            if next == start {
                break;
            }
            if used[next] {
                break;
            }
            cur = next;
            guard += 1;
            if guard > n + 2 {
                return String::new(); // assembly went wrong — bail, fill nothing
            }
        }
        if loop_pts.len() >= 3 {
            for (i, (x, y)) in loop_pts.iter().enumerate() {
                if i == 0 {
                    let _ = write!(d, "M{x:.2},{y:.2}");
                } else {
                    let _ = write!(d, " L{x:.2},{y:.2}");
                }
            }
            d.push_str(" Z ");
        }
    }
    d
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

/// Subset of label / layer toggles that change which OSM features appear in
/// the rendered SVG. Grouped into a single struct so the public `render_svg`
/// signature stays tidy.
pub struct RenderOptions<'a> {
    pub canvas_width: f64,
    pub css: &'a str,
    pub shape: &'a str,
    pub street_labels: bool,
    pub place_labels: bool,
    pub water_labels: bool,
    pub hidden: &'a HashSet<String>,
}

pub fn render_svg(data: &OverpassResponse, bbox: Bbox, opts: RenderOptions<'_>) -> String {
    let RenderOptions {
        canvas_width,
        css,
        shape,
        street_labels,
        place_labels,
        water_labels,
        hidden,
    } = opts;
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
            Element::Way {
                id,
                nodes: refs,
                tags,
            } => {
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
    // (subclass, projected points, is-closed)
    type WayEntry = (String, Vec<(f64, f64)>, bool);
    // (subclass, outer rings, inner rings)
    type MpEntry = (String, Vec<Vec<(f64, f64)>>, Vec<Vec<(f64, f64)>>);
    let mut way_by_layer: HashMap<&'static str, Vec<WayEntry>> = HashMap::new();
    let mut mp_by_layer: HashMap<&'static str, Vec<MpEntry>> = HashMap::new();

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
        if let Element::Way {
            id,
            nodes: refs,
            tags,
        } = el
        {
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
            if info.layer == "road"
                && let Some(name) = tags.get("name")
            {
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

            way_by_layer
                .entry(info.layer)
                .or_default()
                .push((info.subclass, pts, closed));
        }
    }

    for mp in &multipolygons {
        let outer: Vec<Vec<(f64, f64)>> = mp.outer_rings.iter().map(|r| project_ring(r)).collect();
        let inner: Vec<Vec<(f64, f64)>> = mp.inner_rings.iter().map(|r| project_ring(r)).collect();
        mp_by_layer.entry(mp.info.layer).or_default().push((
            mp.info.subclass.clone(),
            outer,
            inner,
        ));
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

    // Fill the sea. OSM has no polygon for the open sea — it's the water side of
    // the coastline — so derive it from the (direction-preserving) coastline
    // winding and fill just above the background, beneath the land layers. The
    // builder bails (empty) on anything it can't close confidently, so we never
    // risk painting land as water. Takes the theme's `.water` fill; the visible
    // coastline stroke is drawn later by the coastline layer.
    if !coastline_way_ids.is_empty() && !hidden.contains("water") {
        let directed = stitch_coastline_directed(&coastline_way_ids, &way_nodes);
        let chains: Vec<Vec<(f64, f64)>> = directed.iter().map(|c| project_ring(c)).collect();
        let d = sea_fill_path(&chains, width, height);
        if !d.is_empty() {
            writeln!(
                out,
                r#"<path class="sea-fill water" fill-rule="evenodd" style="stroke:none" d="{d}"/>"#
            )
            .unwrap();
        }
    }

    for layer in layer_order {
        if hidden.contains(*layer) {
            continue;
        }
        // Emit road casings just before the road layer so colored road strokes
        // overlay the casings.
        if *layer == "road"
            && let Some(items) = way_by_layer.get("road")
        {
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
                    r#"  <polyline class="{subclass}-casing" fill="none" points="{pts_str}"/>"#
                )
                .unwrap();
            }
            writeln!(out, "</g>").unwrap();
        }

        let ways = way_by_layer.get(*layer);
        let mps = mp_by_layer.get(*layer);
        if ways.is_none() && mps.is_none() {
            continue;
        }
        writeln!(out, r#"<g class="layer layer-{layer}">"#).unwrap();
        if let Some(items) = mps {
            // Stitched multipolygons live on filled layers (building / water /
            // landuse / leisure); on non-filled layers a multipolygon path is
            // a line-shaped feature and must stay un-filled — pinning the
            // attribute keeps it correct even when CSS fails to override the
            // SVG default `fill: black`.
            let mp_fill_attr = if layer_is_filled(layer) {
                ""
            } else {
                r#" fill="none""#
            };
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
                        r#"  <path class="{subclass}"{mp_fill_attr} fill-rule="evenodd" d="{d}"/>"#
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
                let tag = if *closed && filled {
                    "polygon"
                } else {
                    "polyline"
                };
                // Polylines must never inherit the SVG default `fill: black`
                // — themes always intend them as stroked lines. We pin the
                // attribute inline so this holds even if a renderer fails to
                // apply the theme's `.layer-X polyline { fill: none }` rule
                // (e.g. Firefox dropping descendant combinators when
                // rasterizing an SVG loaded via <img>).
                let fill_attr = if tag == "polyline" {
                    r#" fill="none""#
                } else {
                    ""
                };
                writeln!(
                    out,
                    r#"  <{tag} class="{subclass}"{fill_attr} points="{pts_str}"/>"#
                )
                .unwrap();
            }
        }
        writeln!(out, "</g>").unwrap();
    }

    // ---- street labels (textPath along road centerlines) ----
    if street_labels && !hidden.contains("road") {
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
            let Some(best) = segments
                .into_iter()
                .max_by(|a, b| a.length.partial_cmp(&b.length).unwrap_or(Ordering::Equal))
            else {
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
                let pts: Vec<(f64, f64)> =
                    if label.points.first().unwrap().0 > label.points.last().unwrap().0 {
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

    // ---- water body features (deduped data block; frontend renders labels) ----
    if water_labels {
        // Collect all lng/lat points per unique name across way segments and
        // relation outer members, plus classify each as sea / lake / river.
        // (points, classification — "sea" | "lake" | "river")
        type WaterGroup = (Vec<(f64, f64)>, &'static str);
        let mut groups: HashMap<String, WaterGroup> = HashMap::new();
        for el in &data.elements {
            match el {
                Element::Way {
                    nodes: refs, tags, ..
                } => {
                    let Some(name) = tags.get("name") else {
                        continue;
                    };
                    let water_tag = tags.get("water").map(String::as_str);
                    let natural = tags.get("natural").map(String::as_str);
                    let waterway = tags.get("waterway").is_some();
                    let kind: &'static str = if waterway {
                        "river"
                    } else if natural == Some("water") {
                        match water_tag {
                            Some("sea") | Some("ocean") | Some("bay") | Some("strait") => "sea",
                            _ => "lake",
                        }
                    } else {
                        continue;
                    };
                    let pts: Vec<(f64, f64)> = refs
                        .iter()
                        .filter_map(|nid| nodes.get(nid).copied())
                        .collect();
                    if pts.is_empty() {
                        continue;
                    }
                    groups
                        .entry(name.clone())
                        .or_insert_with(|| (Vec::new(), kind))
                        .0
                        .extend(pts);
                }
                Element::Relation { members, tags } => {
                    if tags.get("type").map(String::as_str) != Some("multipolygon") {
                        continue;
                    }
                    let natural = tags.get("natural").map(String::as_str);
                    if natural != Some("water") {
                        continue;
                    }
                    let Some(name) = tags.get("name") else {
                        continue;
                    };
                    let water_tag = tags.get("water").map(String::as_str);
                    let kind: &'static str = match water_tag {
                        Some("sea") | Some("ocean") | Some("bay") | Some("strait") => "sea",
                        _ => "lake",
                    };
                    for m in members {
                        if m.member_type != "way" {
                            continue;
                        }
                        if !m.role.is_empty() && m.role != "outer" {
                            continue;
                        }
                        if let Some(refs) = way_nodes.get(&m.ref_id) {
                            let pts: Vec<(f64, f64)> = refs
                                .iter()
                                .filter_map(|nid| nodes.get(nid).copied())
                                .collect();
                            groups
                                .entry(name.clone())
                                .or_insert_with(|| (Vec::new(), kind))
                                .0
                                .extend(pts);
                        }
                    }
                }
                Element::Node { lat, lon, tags, .. } => {
                    // The open sea / oceans / bays are almost never `natural=water`
                    // polygons in OSM — they're named by point features
                    // (`place=sea|ocean|strait`, `natural=bay|strait`). Pick those
                    // up so the Sea/ocean label toggle actually marks the sea.
                    let Some(name) = tags.get("name") else {
                        continue;
                    };
                    let is_sea = matches!(
                        tags.get("place").map(String::as_str),
                        Some("sea") | Some("ocean") | Some("strait")
                    ) || matches!(
                        tags.get("natural").map(String::as_str),
                        Some("bay") | Some("strait")
                    );
                    if is_sea {
                        groups
                            .entry(name.clone())
                            .or_insert_with(|| (Vec::new(), "sea"))
                            .0
                            .push((*lon, *lat));
                    }
                }
            }
        }

        if !groups.is_empty() {
            // Emit a hidden data block so the frontend can render labels
            // client-side (and let users drag them).
            writeln!(
                out,
                r#"<g class="layer-water-features-data" style="display:none">"#
            )
            .unwrap();
            for (name, (pts, kind)) in &groups {
                if pts.is_empty() {
                    continue;
                }
                let n = pts.len() as f64;
                let cx = pts.iter().map(|p| p.0).sum::<f64>() / n;
                let cy = pts.iter().map(|p| p.1).sum::<f64>() / n;
                writeln!(
                    out,
                    r#"  <text class="water-feature" data-name="{name}" data-kind="{kind}" data-lng="{cx:.6}" data-lat="{cy:.6}"></text>"#,
                    name = escape_xml(name),
                )
                .unwrap();
            }
            writeln!(out, "</g>").unwrap();
        }
    }

    // ---- place labels ----
    if place_labels && !place_nodes.is_empty() {
        place_nodes.sort_by_key(|(_, _, kind, _)| place_priority(kind));
        writeln!(out, r#"<g class="layer layer-places">"#).unwrap();
        for (lon, lat, kind, name) in &place_nodes {
            if *lat < bbox.south || *lat > bbox.north || *lon < bbox.west || *lon > bbox.east {
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

    if is_circle {
        writeln!(out, "</g>").unwrap();
    }
    out.push_str("</svg>\n");
    out
}

#[cfg(test)]
mod sea_tests {
    use super::*;

    fn centroid_x(d: &str) -> f64 {
        let xs: Vec<f64> = d
            .split(|c: char| c == 'M' || c == 'L' || c == 'Z' || c == ' ')
            .filter(|s| s.contains(','))
            .map(|s| s.split(',').next().unwrap().parse::<f64>().unwrap())
            .collect();
        xs.iter().sum::<f64>() / xs.len() as f64
    }

    // A coastline crossing the 100×100 viewport top→bottom at x=40, travelling
    // downward (+y in canvas). Sea is on the LEFT of travel, which for downward
    // screen travel is the +x (east) half — the fill must land there.
    #[test]
    fn sea_fills_left_of_travel() {
        let chains = vec![vec![(40.0, -10.0), (40.0, 110.0)]];
        let d = sea_fill_path(&chains, 100.0, 100.0);
        assert!(!d.is_empty(), "expected a sea polygon");
        let cx = centroid_x(&d);
        assert!(cx > 50.0, "sea should fill the +x half; centroid x = {cx}");
    }

    // Reversed coastline (travelling up) flips the sea to the −x (west) half.
    #[test]
    fn sea_flips_with_direction() {
        let chains = vec![vec![(40.0, 110.0), (40.0, -10.0)]];
        let d = sea_fill_path(&chains, 100.0, 100.0);
        assert!(!d.is_empty());
        assert!(
            centroid_x(&d) < 50.0,
            "reversed coast should fill the −x half"
        );
    }

    // No coastline crossing the view → nothing to fill (no false sea).
    #[test]
    fn no_coastline_no_fill() {
        assert!(sea_fill_path(&[], 100.0, 100.0).is_empty());
        let outside = vec![vec![(-50.0, -50.0), (-40.0, -60.0)]];
        assert!(sea_fill_path(&outside, 100.0, 100.0).is_empty());
    }
}
