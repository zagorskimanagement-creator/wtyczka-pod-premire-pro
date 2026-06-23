// ExtendScript — runs inside Premiere Pro's scripting engine.
// All functions communicate via JSON strings.

var TICKS_PER_SECOND = 254016000000;

function msToTicks(ms) {
  return Math.round((ms / 1000) * TICKS_PER_SECOND).toString();
}

function ticksToMs(ticks) {
  return Math.round((parseFloat(ticks) / TICKS_PER_SECOND) * 1000);
}

// ─── Sequence info ────────────────────────────────────────────────────────────

function getActiveSequenceInfo() {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    return JSON.stringify({
      name: seq.name,
      id: seq.sequenceID,
      durationMs: Math.round(seq.end.seconds * 1000),
      videoTrackCount: seq.videoTracks.numTracks,
      audioTrackCount: seq.audioTracks.numTracks,
      width: seq.frameSizeHorizontal,
      height: seq.frameSizeVertical,
    });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// ─── Project import ───────────────────────────────────────────────────────────

function importVideo(filePath) {
  try {
    app.project.importFiles([filePath], true, null, false);
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// ─── Clip finder ──────────────────────────────────────────────────────────────

function findProjectClip(clipName) {
  var root = app.project.rootItem;
  var i, item;
  for (i = 0; i < root.children.numItems; i++) {
    item = root.children[i];
    if (item.name.indexOf(clipName) !== -1 || clipName.indexOf(item.name) !== -1) {
      return item;
    }
  }
  for (i = 0; i < root.children.numItems; i++) {
    if (root.children[i].type === ProjectItemType.CLIP) return root.children[i];
  }
  return null;
}

// ─── Clear all tracks ─────────────────────────────────────────────────────────

function clearAllTracks(seq) {
  var i, track;
  for (i = 0; i < seq.videoTracks.numTracks; i++) {
    track = seq.videoTracks[i];
    while (track.clips.numItems > 0) track.clips[0].remove(false, false);
  }
  for (i = 0; i < seq.audioTracks.numTracks; i++) {
    track = seq.audioTracks[i];
    while (track.clips.numItems > 0) track.clips[0].remove(false, false);
  }
}

// ─── Setup sequence from multiple source clips (merge) ───────────────────────

function setupSequenceWithMultipleClips(clipNamesJson, segmentsJson) {
  try {
    var clipNames = JSON.parse(clipNamesJson);
    var segments  = JSON.parse(segmentsJson);
    if (!segments || segments.length === 0) return JSON.stringify({ error: 'No segments' });

    var clips = [];
    for (var c = 0; c < clipNames.length; c++) {
      var found = findProjectClip(clipNames[c]);
      if (!found) return JSON.stringify({ error: 'Clip not found: ' + clipNames[c] });
      clips.push(found);
    }

    var seqName = clipNames[0].substring(0, 30) + ' - ShortForge Merge';
    app.project.createNewSequenceFromClips(seqName, [clips[0]], app.project.rootItem);
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'Could not create sequence' });

    clearAllTracks(seq);

    var timelineSec = 0;
    for (var k = 0; k < segments.length; k++) {
      var seg    = segments[k];
      var idx    = (typeof seg.clipIndex === 'number' ? seg.clipIndex : 0);
      if (idx >= clips.length) idx = 0;
      var src    = clips[idx];
      var inSec  = seg.startMs / 1000;
      var outSec = seg.endMs   / 1000;
      if (outSec <= inSec) continue;
      seq.videoTracks[0].insertClip(src, timelineSec, inSec, outSec);
      timelineSec += (outSec - inSec);
    }

    return JSON.stringify({ success: true, name: seq.name, totalMs: Math.round(timelineSec * 1000) });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// ─── Setup sequence with multiple keep segments ───────────────────────────────

function setupSequenceWithSegments(clipName, segmentsJson) {
  try {
    var segments = JSON.parse(segmentsJson);
    if (!segments || segments.length === 0) return JSON.stringify({ error: 'No segments' });

    var targetItem = findProjectClip(clipName);
    if (!targetItem) return JSON.stringify({ error: 'No clip found in project' });

    var seqName = clipName.substring(0, 40) + ' - ShortForge';
    app.project.createNewSequenceFromClips(seqName, [targetItem], app.project.rootItem);
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'Could not create sequence' });

    clearAllTracks(seq);

    var timelineSec = 0;
    for (var k = 0; k < segments.length; k++) {
      var seg = segments[k];
      var inSec  = seg.startMs / 1000;
      var outSec = seg.endMs   / 1000;
      if (outSec <= inSec) continue;
      seq.videoTracks[0].insertClip(targetItem, timelineSec, inSec, outSec);
      timelineSec += (outSec - inSec);
    }

    return JSON.stringify({ success: true, name: seq.name, totalMs: Math.round(timelineSec * 1000) });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// ─── Reframe to target aspect ratio ──────────────────────────────────────────

function reframeSequence(targetFormat) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });

    if (targetFormat === '9:16') {
      // Try Premiere Pro's built-in Auto Reframe (PP 14.0+) — a separate effect
      // that tracks the subject; coexists fine with Motion-Scale transitions.
      try {
        seq.autoReframeSequence(9, 16, 1, seq.name.replace('ShortForge', 'ShortForge 9x16'));
        return JSON.stringify({ success: true, method: 'autoReframe' });
      } catch (reframeErr) {
        // Fallback: scale all clips to fill vertical crop (center of frame)
        var track = seq.videoTracks[0];
        for (var i = 0; i < track.clips.numItems; i++) {
          var sp = _param(_comp(track.clips[i], ['Motion', 'AE.ADBE Motion']), ['Scale']);
          if (sp) { try { sp.setValue(178, true); } catch (se) {} }
        }
        return JSON.stringify({ success: true, method: 'manualScale178', note: 'Clips scaled for vertical crop. Export as 1080x1920 for true 9:16.' });
      }
    }

    if (targetFormat === '1:1') {
      try {
        seq.autoReframeSequence(1, 1, 1, seq.name.replace('ShortForge', 'ShortForge 1x1'));
        return JSON.stringify({ success: true, method: 'autoReframe' });
      } catch (e2) {
        var track2 = seq.videoTracks[0];
        for (var j = 0; j < track2.clips.numItems; j++) {
          var sp2 = _param(_comp(track2.clips[j], ['Motion', 'AE.ADBE Motion']), ['Scale']);
          if (sp2) { try { sp2.setValue(133, true); } catch (se2) {} }
        }
        return JSON.stringify({ success: true, method: 'manualScale133' });
      }
    }

    // 16:9 = default, nothing to do
    return JSON.stringify({ success: true, method: 'noChange' });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// ─── Transitions ──────────────────────────────────────────────────────────────
// ALL transitions are keyframe-based (Scale + Rotation + Opacity on Motion/Opacity
// intrinsic effects). No QE / Adobe transition API needed — that API requires
// clip "handles" (extra source frames) which we never have after insertClip.

// ── helpers ──

var KF_BEZIER = 2; // Bezier interpolation = smooth, "hand-keyed" feel
var _kfStat = { set: 0, fail: 0 };
function _resetKf() { _kfStat = { set: 0, fail: 0 }; }

// IMPORTANT: seq.timebase is TICKS-PER-FRAME, not fps. Real fps must be derived.
function _fps(seq) {
  try {
    var tb = parseFloat(seq.timebase);
    if (tb && tb > 0) return TICKS_PER_SECOND / tb;
  } catch (e) {}
  return 30;
}

function _tk(sec) {
  return { seconds: sec, ticks: msToTicks(sec * 1000) };
}

// Find a component on a clip by display name / matchName — robust across PP versions.
function _comp(clip, names) {
  for (var a = 0; a < names.length; a++) {
    try {
      if (typeof clip.getComponentByDisplayName === 'function') {
        var c = clip.getComponentByDisplayName(names[a]);
        if (c) return c;
      }
    } catch (e) {}
  }
  try {
    for (var i = 0; i < clip.components.numItems; i++) {
      var comp = clip.components[i];
      for (var b = 0; b < names.length; b++) {
        try { if (comp.displayName === names[b]) return comp; } catch (e1) {}
        try { if (comp.matchName === names[b]) return comp; } catch (e2) {}
      }
    }
  } catch (e3) {}
  return null;
}

function _param(comp, names) {
  if (!comp) return null;
  for (var a = 0; a < names.length; a++) {
    try {
      if (comp.properties && typeof comp.properties.getParamForDisplayName === 'function') {
        var p = comp.properties.getParamForDisplayName(names[a]);
        if (p) return p;
      }
    } catch (e) {}
  }
  try {
    for (var i = 0; i < comp.properties.numItems; i++) {
      var pp = comp.properties[i];
      for (var b = 0; b < names.length; b++) {
        try { if (pp.displayName === names[b]) return pp; } catch (e1) {}
      }
    }
  } catch (e2) {}
  return null;
}

function _enableKeys(p) {
  try { p.setTimeVarying(true); return; } catch (e) {}
  try { p.timeVarying = true; } catch (e2) {}
}

// Robustly set a keyframe. Tries the seconds-based API first (most widely
// supported), then the Time-object API. Applies Bezier easing best-effort.
function _key(p, sec, value, ease) {
  if (!p) { _kfStat.fail++; return false; }
  _enableKeys(p);
  var ok = false;
  // Method A: seconds-based  addKey(sec) + setValueAtKey(sec, val, true)
  try {
    p.addKey(sec);
    try { p.setValueAtKey(sec, value, true); ok = true; }
    catch (eA) { try { p.setValueAtKey(sec, value); ok = true; } catch (eA2) {} }
  } catch (e) {}
  // Method B: Time-object  addKey(t) + setValueAtTime(t, val)
  if (!ok) {
    try {
      var t = _tk(sec);
      p.addKey(t);
      try { p.setValueAtTime(t, value); ok = true; } catch (eB) {}
    } catch (e) {}
  }
  if (ok && ease) {
    try { p.setInterpolationTypeAtKey(sec, KF_BEZIER, true); } catch (e) {}
    try { p.setInterpolationTypeAtKey(_tk(sec), KF_BEZIER, true); } catch (e2) {}
  }
  if (ok) _kfStat.set++; else _kfStat.fail++;
  return ok;
}

function _scaleKey(clip, sec, val) {
  _key(_param(_comp(clip, ['Motion', 'AE.ADBE Motion']), ['Scale']), sec, val, true);
}
function _rotKey(clip, sec, deg) {
  _key(_param(_comp(clip, ['Motion', 'AE.ADBE Motion']), ['Rotation']), sec, deg, true);
}
function _opKey(clip, sec, val) {
  _key(_param(_comp(clip, ['Opacity', 'AE.ADBE Opacity']), ['Opacity']), sec, val, true);
}

// Deterministic per-cut jitter so transitions don't feel mechanically identical.
function _vary(base, amt, i) {
  var r = Math.sin((i + 1) * 12.9898) * 43758.5453;
  r = r - Math.floor(r);            // 0..1
  return base + (r * 2 - 1) * amt;  // base ± amt
}

// ── per-clip animation guard: skip if clip too short ──
function _tooShort(clip, dur) {
  return (clip.end.seconds - clip.start.seconds) < dur * 2.5;
}

// ── Zoom Blur: scale 100→210 + opacity 100→0 on exit; reverse on enter ──
// The most viral style — feels fast and energetic.
function addZoomBlurTransitions(durationFrames) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    var dur   = (durationFrames || 12) / _fps(seq);
    var n     = track.clips.numItems;

    for (var i = 0; i < n; i++) {
      var clip = track.clips[i];
      if (_tooShort(clip, dur)) continue;

      // Vary peak zoom (185–235%) and timing slightly per cut for a hand-made feel
      var peak   = _vary(210, 25, i);
      var dExit  = dur * _vary(1.0, 0.15, i);
      var dEnter = dur * _vary(1.0, 0.15, i + 7);

      if (i < n - 1) {  // exit
        _scaleKey(clip, clip.end.seconds - dExit, 100);
        _scaleKey(clip, clip.end.seconds,         peak);
        _opKey(clip,    clip.end.seconds - dExit * 0.7, 100);
        _opKey(clip,    clip.end.seconds,           0);
      }
      if (i > 0) {       // enter
        _scaleKey(clip, clip.start.seconds,          peak);
        _scaleKey(clip, clip.start.seconds + dEnter, 100);
        _opKey(clip,    clip.start.seconds,            0);
        _opKey(clip,    clip.start.seconds + dEnter * 0.7, 100);
      }
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ── Spin: rotate 0→80° + scale 100→5% + fade on exit; reverse on enter ──
function addSpinTransitions(durationFrames) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    var dur   = (durationFrames || 12) / _fps(seq);
    var n     = track.clips.numItems;

    for (var i = 0; i < n; i++) {
      var clip = track.clips[i];
      if (_tooShort(clip, dur)) continue;

      if (i < n - 1) {
        _rotKey(clip,   clip.end.seconds - dur, 0);
        _rotKey(clip,   clip.end.seconds,       80);
        _scaleKey(clip, clip.end.seconds - dur, 100);
        _scaleKey(clip, clip.end.seconds,         5);
        _opKey(clip,    clip.end.seconds - dur * 0.6, 100);
        _opKey(clip,    clip.end.seconds,              0);
      }
      if (i > 0) {
        _rotKey(clip,   clip.start.seconds,      -80);
        _rotKey(clip,   clip.start.seconds + dur,   0);
        _scaleKey(clip, clip.start.seconds,          5);
        _scaleKey(clip, clip.start.seconds + dur,  100);
        _opKey(clip,    clip.start.seconds,          0);
        _opKey(clip,    clip.start.seconds + dur * 0.4, 100);
      }
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ── Glitch: 7 rapid scale micro-pulses on exit of every clip ──
// Short bursts — each step is just 1-2 frames.
function addGlitchTransitions(durationFrames) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    var dur   = (durationFrames || 7) / _fps(seq);
    var n     = track.clips.numItems;

    var scales = [100, 112, 93, 118, 90, 106, 100];
    var ops    = [100,  75, 100,  55, 100,  85, 100];

    for (var i = 0; i < n - 1; i++) {
      var clip = track.clips[i];
      if (_tooShort(clip, dur)) continue;
      var step = dur / (scales.length - 1);
      for (var j = 0; j < scales.length; j++) {
        var t = clip.end.seconds - dur + step * j;
        if (t < clip.start.seconds) continue;
        _scaleKey(clip, t, scales[j]);
        _opKey(clip, t, ops[j]);
      }
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ── Film Burn: fast fade-out + slight overexposure scale spike, then fade-in ──
// Old-film analogue feel — warm and editorial.
function addFilmBurnTransitions(durationFrames) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    var dur   = (durationFrames || 10) / _fps(seq);
    var half  = dur * 0.5;
    var n     = track.clips.numItems;

    for (var i = 0; i < n; i++) {
      var clip = track.clips[i];
      if (_tooShort(clip, dur)) continue;

      if (i < n - 1) {
        // Scale "burns" up briefly then fades to black
        _scaleKey(clip, clip.end.seconds - dur,   100);
        _scaleKey(clip, clip.end.seconds - half,  112); // overexposure spike
        _scaleKey(clip, clip.end.seconds,         100);
        _opKey(clip,    clip.end.seconds - dur,   100);
        _opKey(clip,    clip.end.seconds,           0);
      }
      if (i > 0) {
        _scaleKey(clip, clip.start.seconds,        112);
        _scaleKey(clip, clip.start.seconds + half, 100);
        _opKey(clip,    clip.start.seconds,          0);
        _opKey(clip,    clip.start.seconds + dur,  100);
      }
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ── Dissolve: simple opacity cross-fade (clean, minimal) ──
function addDissolveTransitions(durationFrames) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    var dur   = (durationFrames || 14) / _fps(seq);
    var n     = track.clips.numItems;

    for (var i = 0; i < n; i++) {
      var clip = track.clips[i];
      if (_tooShort(clip, dur)) continue;

      if (i < n - 1) {
        _opKey(clip, clip.end.seconds - dur, 100);
        _opKey(clip, clip.end.seconds,         0);
      }
      if (i > 0) {
        _opKey(clip, clip.start.seconds,       0);
        _opKey(clip, clip.start.seconds + dur, 100);
      }
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ── Flash: very fast opacity dip + quick scale spike (strobe / camera flash) ──
function addFlashTransitions(durationFrames) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    var dur   = (durationFrames || 6) / _fps(seq);
    var half  = dur * 0.4;
    var n     = track.clips.numItems;

    for (var i = 0; i < n; i++) {
      var clip = track.clips[i];
      if (_tooShort(clip, dur)) continue;

      if (i < n - 1) {
        _scaleKey(clip, clip.end.seconds - dur,  100);
        _scaleKey(clip, clip.end.seconds - half, 118); // bright flash spike
        _scaleKey(clip, clip.end.seconds,        100);
        _opKey(clip,    clip.end.seconds - dur,  100);
        _opKey(clip,    clip.end.seconds,          0);
      }
      if (i > 0) {
        _scaleKey(clip, clip.start.seconds,        118);
        _scaleKey(clip, clip.start.seconds + half, 100);
        _opKey(clip,    clip.start.seconds,          0);
        _opKey(clip,    clip.start.seconds + dur,  100);
      }
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ── Breathe: very subtle ambient scale 100→103→100 over each clip ──
// Not a "cut transition" — it adds a slow organic heartbeat to every clip,
// making the video feel alive even with hard cuts.
function addBreatheEffect() {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];

    for (var i = 0; i < track.clips.numItems; i++) {
      var clip = track.clips[i];
      var len  = clip.end.seconds - clip.start.seconds;
      if (len < 0.8) continue;

      var mid = clip.start.seconds + len * 0.5;
      // Settle the scale at start so it doesn't fight with other transitions
      _scaleKey(clip, clip.start.seconds,       100);
      _scaleKey(clip, mid,                      103.5);
      _scaleKey(clip, clip.end.seconds - 0.04, 100);
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ── Zoom Punch (legacy): scale 100→125 hit at cut ──
function addZoomPunchTransitions(durationFrames) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    var dur   = (durationFrames || 10) / _fps(seq);
    var n     = track.clips.numItems;

    for (var i = 0; i < n; i++) {
      var clip = track.clips[i];
      if (_tooShort(clip, dur)) continue;

      if (i < n - 1) {
        _scaleKey(clip, clip.end.seconds - dur, 100);
        _scaleKey(clip, clip.end.seconds,       125);
      }
      if (i > 0) {
        _scaleKey(clip, clip.start.seconds,       125);
        _scaleKey(clip, clip.start.seconds + dur, 100);
      }
    }
    return JSON.stringify({ success: true });
  } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ── Main dispatcher ──
function applyTransitions(transitionType, durationFrames) {
  var frames = durationFrames || 15;
  if (transitionType === 'cut' || !transitionType) {
    return JSON.stringify({ success: true, transition: 'cut', keysSet: 0, keysFailed: 0 });
  }
  _resetKf();
  try {
    switch (transitionType) {
      case 'zoomBlur':  addZoomBlurTransitions(frames); break;
      case 'spin':      addSpinTransitions(frames); break;
      case 'glitch':    addGlitchTransitions(Math.round(frames * 0.55)); break;
      case 'filmBurn':  addFilmBurnTransitions(frames); break;
      case 'breathe':   addBreatheEffect(); break;
      case 'dissolve':  addDissolveTransitions(frames); break;
      case 'flash':     addFlashTransitions(Math.round(frames * 0.5)); break;
      case 'dip':       addDissolveTransitions(Math.round(frames * 0.8)); break;
      case 'zoom':      addZoomPunchTransitions(Math.round(frames * 0.7)); break;
    }
  } catch (e) {
    return JSON.stringify({ error: e.toString(), keysSet: _kfStat.set, keysFailed: _kfStat.fail });
  }
  return JSON.stringify({
    success: true,
    transition: transitionType,
    keysSet: _kfStat.set,
    keysFailed: _kfStat.fail,
  });
}

// ─── Captions ─────────────────────────────────────────────────────────────────

function importCaptionsText(srtContent) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });

    var tempFile = new File(Folder.temp.absoluteURI + '/shortforge_captions.srt');
    tempFile.open('w');
    tempFile.write(srtContent);
    tempFile.close();

    seq.importCaptionFromSRT(tempFile.absoluteURI, 0, 0, true);
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// ─── Motion effects ───────────────────────────────────────────────────────────

function applyZoom(startMs, endMs, scale) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    if (!track) return JSON.stringify({ error: 'No video track' });
    var startSec = startMs / 1000;
    var endSec   = endMs   / 1000;
    var peak     = scale * 100;

    for (var i = 0; i < track.clips.numItems; i++) {
      var clip = track.clips[i];
      // Apply if this clip's timeline range overlaps the zoom range
      if (clip.start.seconds <= startSec && clip.end.seconds >= endSec) {
        _scaleKey(clip, startSec, 100);
        _scaleKey(clip, endSec,   peak);
      }
    }
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// ─── Playhead ─────────────────────────────────────────────────────────────────

function setPlayheadPosition(ms) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    seq.setPlayerPosition(msToTicks(ms));
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

function getCurrentPlayheadMs() {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    return JSON.stringify({ ms: Math.round(seq.getPlayerPosition().seconds * 1000) });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}
