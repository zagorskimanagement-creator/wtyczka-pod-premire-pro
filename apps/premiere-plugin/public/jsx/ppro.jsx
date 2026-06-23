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

// Find a clip by name in the project root (falls back to first clip)
function findProjectClip(clipName) {
  var root = app.project.rootItem;
  for (var i = 0; i < root.children.numItems; i++) {
    var item = root.children[i];
    if (item.name.indexOf(clipName) !== -1 || clipName.indexOf(item.name) !== -1) {
      return item;
    }
  }
  // Fall back to first clip
  for (var j = 0; j < root.children.numItems; j++) {
    if (root.children[j].type === ProjectItemType.CLIP) {
      return root.children[j];
    }
  }
  return null;
}

// Clear all clips from all video and audio tracks
function clearAllTracks(seq) {
  var i, track;
  for (i = 0; i < seq.videoTracks.numTracks; i++) {
    track = seq.videoTracks[i];
    while (track.clips.numItems > 0) {
      track.clips[0].remove(false, false);
    }
  }
  for (i = 0; i < seq.audioTracks.numTracks; i++) {
    track = seq.audioTracks[i];
    while (track.clips.numItems > 0) {
      track.clips[0].remove(false, false);
    }
  }
}

// Create a fresh sequence and insert multiple keep segments from a source clip.
// segmentsJson: [{ startMs, endMs }, ...]
function setupSequenceWithSegments(clipName, segmentsJson) {
  try {
    var segments = JSON.parse(segmentsJson);
    if (!segments || segments.length === 0) {
      return JSON.stringify({ error: 'No segments provided' });
    }

    var targetItem = findProjectClip(clipName);
    if (!targetItem) return JSON.stringify({ error: 'No clip found in project' });

    // Create a new sequence matched to clip settings
    var seqName = clipName + ' - ShortForge';
    app.project.createNewSequenceFromClips(seqName, [targetItem], app.project.rootItem);
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'Could not create sequence' });

    // Remove everything auto-added by createNewSequenceFromClips
    clearAllTracks(seq);

    // Insert each keep segment back-to-back on the timeline
    var timelineSec = 0;
    for (var k = 0; k < segments.length; k++) {
      var seg = segments[k];
      var inSec  = seg.startMs / 1000;
      var outSec = seg.endMs   / 1000;
      if (outSec <= inSec) continue;
      seq.videoTracks[0].insertClip(targetItem, timelineSec, inSec, outSec);
      timelineSec += (outSec - inSec);
    }

    return JSON.stringify({ success: true, name: seq.name, totalDurationMs: Math.round(timelineSec * 1000) });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// Write SRT content to a temp file and import it as a caption track.
function importCaptionsText(srtContent) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return JSON.stringify({ error: 'No active sequence' });

    var tempFile = new File(Folder.temp.absoluteURI + '/shortforge_captions.srt');
    tempFile.open('w');
    tempFile.write(srtContent);
    tempFile.close();

    // importCaptionFromSRT(path, startTimeSec, framerate, replaceExisting)
    seq.importCaptionFromSRT(tempFile.absoluteURI, 0, 0, true);

    return JSON.stringify({ success: true });
  } catch (e) {
    return JSON.stringify({ error: e.toString() });
  }
}

// Add Cross Dissolve transitions between all adjacent clips on V1.
function addTransitionsBetweenClips(durationFrames) {
  try {
    app.enableQE();
    var qeSeq = qe.sequence;
    if (!qeSeq) return JSON.stringify({ error: 'QE sequence not available' });

    var track = qeSeq.videoTrack(0);
    if (!track) return JSON.stringify({ error: 'No video track' });

    var numClips = track.numItems;
    if (numClips < 2) return JSON.stringify({ success: true, note: 'Only one clip, no transitions needed' });

    var frames = durationFrames || 15;

    for (var i = 1; i < numClips; i++) {
      try {
        var clip = track.clip(i);
        // alignment 1 = start of clip, 2 = center on cut, 3 = end of clip
        clip.addTransition('Cross Dissolve', 1, frames);
      } catch (transErr) {
        // Skip if transition can't be applied to this clip
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
            var t1 = { seconds: endSec,   ticks: msToTicks(endMs) };
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
