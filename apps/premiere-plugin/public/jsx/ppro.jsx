// ExtendScript — runs inside Premiere Pro's scripting engine.
// All functions communicate via JSON strings.

var TICKS_PER_SECOND = 254016000000;

function msToTicks(ms) {
  return Math.round((ms / 1000) * TICKS_PER_SECOND).toString();
}

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
    });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

function importVideo(filePath) {
  try {
    app.project.importFiles([filePath], true, null, false);
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

function createSequence(name) {
  try {
    var seq = app.project.sequences.createSequence(name, '');
    return JSON.stringify({ success: true, name: seq.name, id: seq.sequenceID });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

function createSequenceFromClip(clipName) {
  try {
    var root = app.project.rootItem;
    var targetItem = null;

    // Search project items for the clip
    for (var i = 0; i < root.children.numItems; i++) {
      var item = root.children[i];
      if (item.name.indexOf(clipName) !== -1 || clipName.indexOf(item.name) !== -1) {
        targetItem = item;
        break;
      }
    }

    // Fall back to first video item if name not matched
    if (!targetItem) {
      for (var j = 0; j < root.children.numItems; j++) {
        var child = root.children[j];
        if (child.type === ProjectItemType.CLIP) {
          targetItem = child;
          break;
        }
      }
    }

    if (!targetItem) return JSON.stringify({ error: 'No clip found in project' });

    // Create sequence from clip (matches clip settings automatically)
    app.project.createNewSequenceFromClips(clipName, [targetItem], app.project.rootItem);

    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'Sequence created but not active' });

    return JSON.stringify({ success: true, name: seq.name });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

function removeCut(startMs, endMs) {
  try {
    app.enableQE();
    var qeSeq = qe.sequence;
    var startSec = startMs / 1000;
    var endSec = endMs / 1000;
    for (var i = 0; i < qeSeq.numVideoTracks; i++) {
      var track = qeSeq.videoTrack(i);
      for (var j = 0; j < track.numItems; j++) {
        var clip = track.clip(j);
        var clipStart = clip.inPoint.seconds;
        var clipEnd = clipStart + clip.duration.seconds;
        if (clipStart <= startSec && clipEnd >= endSec) {
          clip.remove(true, true);
          break;
        }
      }
    }
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

function applyZoom(startMs, endMs, scale) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });
    var track = seq.videoTracks[0];
    if (!track) return JSON.stringify({ error: 'No video track' });
    var startSec = startMs / 1000;
    var endSec = endMs / 1000;
    for (var i = 0; i < track.clips.numItems; i++) {
      var clip = track.clips[i];
      if (clip.start.seconds <= startSec && clip.end.seconds >= endSec) {
        var motion = clip.getComponentByDisplayName('Motion');
        if (motion) {
          var scaleParam = motion.properties.getParamForDisplayName('Scale');
          if (scaleParam) {
            var t0 = { seconds: startSec, ticks: msToTicks(startMs) };
            var t1 = { seconds: endSec, ticks: msToTicks(endMs) };
            scaleParam.addKey(t0);
            scaleParam.addKey(t1);
            scaleParam.setValueAtTime(t0, 100);
            scaleParam.setValueAtTime(t1, scale * 100);
          }
        }
      }
    }
    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

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
    var pos = seq.getPlayerPosition();
    return JSON.stringify({ ms: Math.round(pos.seconds * 1000) });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}
