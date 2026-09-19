// SyncController: maps video timestamp -> camera pose for the 3D viewer
// Takes camera_trajectory.json poses and the current video time,
// interpolates the camera pose for that timestamp, and returns it.
import { useMemo } from 'react';

/**
 * Given an array of camera poses [{frame_index, rotation, translation, timestamp_ms}]
 * and the current video playback time in seconds, interpolate the nearest camera pose.
 */
export function useSync(cameraPoses, currentVideoTimeSecs) {
  return useMemo(() => {
    if (!cameraPoses || cameraPoses.length === 0) return null;
    const targetMs = currentVideoTimeSecs * 1000;

    // Find nearest pose by timestamp
    let nearest = cameraPoses[0];
    let minDiff = Math.abs((cameraPoses[0].timestamp_ms ?? 0) - targetMs);

    for (const pose of cameraPoses) {
      const diff = Math.abs((pose.timestamp_ms ?? 0) - targetMs);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = pose;
      }
    }
    return nearest;
  }, [cameraPoses, currentVideoTimeSecs]);
}

export default function SyncController({ cameraPoses, currentVideoTime, children }) {
  const activePose = useSync(cameraPoses, currentVideoTime);
  // Pass activePose down via render prop pattern so Canvas3D can use it
  return children(activePose);
}
