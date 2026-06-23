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
      // Try Premiere Pro's built-in Auto Reframe (PP 14.0+)
      try {
        seq.autoReframeSequence(9, 16, 1, seq.name.replace('ShortForge', 'ShortForge 9x16'));
        return JSON.stringify({ success: true, method: 'autoReframe' });
      } catch (reframeErr) {
        // Fallback: scale all clips to fill vertical crop (center of frame)
        var track = seq.videoTracks[0];
        for (var i = 0; i < track.clips.numItems; i++) {
          var clip = track.clips[i];
          var motion = clip.getComponentByDisplayName('Motion');
          if (!motion) continue;
          var scaleParam = motion.properties.getParamForDisplayName('Scale');
          var posYParam  = motion.properties.getParamForDisplayName('Position');
          if (scaleParam) scaleParam.setValue(178, true);  // fill 9:16 height
          if (posYParam)  posYParam.setValue(540, true);   // center vertically
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
          var clip2 = track2.clips[j];
          var motion2 = clip2.getComponentByDisplayName('Motion');
          if (!motion2) continue;
          var sp = motion2.properties.getParamForDisplayName('Scale');
          if (sp) sp.setValue(133, true);  // fill square from 16:9
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

// Add standard named transitions (dissolve, flash, dip) between all clips via QE
function addNamedTransitions(transitionName, durationFrames) {
  try {
    app.enableQE();
    var qeSeq = qe.sequence;
    if (!qeSeq) return JSON.stringify({ error: 'QE not available' });

    var track = qeSeq.videoTrack(0);
    if (!track || track.numItems < 2) return JSON.stringify({ success: true });

    var frames = durationFrames || 15;
    for (var i = 1; i < track.numItems; i++) {
      try {
        track.clip(i).addTransition(transitionName, 2, frames); // 2 = centered on cut
      } catch (te) {
        try {
          track.clip(i).addTransition(transitionName, 1, frames); // 1 = at start
        } catch (te2) { /* skip */ }
      }
    }
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// Zoom punch: scale 100→125 at end of each clip, 125→100 at start of next
function addZoomPunchTransitions(durationFrames) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });

    var track = seq.videoTracks[0];
    var fps   = seq.timebase;
    var durSec = (durationFrames || 10) / fps;

    for (var i = 0; i < track.clips.numItems; i++) {
      var clip   = track.clips[i];
      var motion = clip.getComponentByDisplayName('Motion');
      if (!motion) continue;
      var scale = motion.properties.getParamForDisplayName('Scale');
      if (!scale) continue;

      var clipDurSec = clip.end.seconds - clip.start.seconds;
      if (clipDurSec < durSec * 2.5) continue;

      // Zoom OUT at end (punch to next clip)
      if (i < track.clips.numItems - 1) {
        var t1s = clip.end.seconds - durSec;
        var t1e = clip.end.seconds;
        var kStart = { seconds: t1s, ticks: msToTicks(t1s * 1000) };
        var kEnd   = { seconds: t1e, ticks: msToTicks(t1e * 1000) };
        scale.addKey(kStart); scale.addKey(kEnd);
        scale.setValueAtTime(kStart, 100);
        scale.setValueAtTime(kEnd,   125);
      }

      // Zoom IN at start (from punch)
      if (i > 0) {
        var t2s = clip.start.seconds;
        var t2e = clip.start.seconds + durSec;
        var kIn  = { seconds: t2s, ticks: msToTicks(t2s * 1000) };
        var kOut = { seconds: t2e, ticks: msToTicks(t2e * 1000) };
        scale.addKey(kIn); scale.addKey(kOut);
        scale.setValueAtTime(kIn,  125);
        scale.setValueAtTime(kOut, 100);
      }
    }
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// Main transition dispatcher
function applyTransitions(transitionType, durationFrames) {
  var frames = durationFrames || 15;
  switch (transitionType) {
    case 'dissolve':  return addNamedTransitions('Cross Dissolve', frames);
    case 'flash':     return addNamedTransitions('Dip to White',   frames);
    case 'dip':       return addNamedTransitions('Dip to Black',   frames);
    case 'zoom':      return addZoomPunchTransitions(Math.round(frames * 0.7));
    default:          return JSON.stringify({ success: true }); // 'cut' = no transition
  }
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

    for (var i = 0; i < track.clips.numItems; i++) {
      var clip = track.clips[i];
      // Check if this clip's timeline range overlaps with the zoom range
      if (clip.start.seconds <= startSec && clip.end.seconds >= endSec) {
        var motion = clip.getComponentByDisplayName('Motion');
        if (!motion) continue;
        var scaleParam = motion.properties.getParamForDisplayName('Scale');
        if (!scaleParam) continue;
        var t0 = { seconds: startSec, ticks: msToTicks(startMs) };
        var t1 = { seconds: endSec,   ticks: msToTicks(endMs) };
        scaleParam.addKey(t0); scaleParam.addKey(t1);
        scaleParam.setValueAtTime(t0, 100);
        scaleParam.setValueAtTime(t1, scale * 100);
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
