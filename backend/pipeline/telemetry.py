"""
telemetry.py — GPS/IMU Telemetry Parsing & Trajectory Alignment

Parses drone flight telemetry logs (CSV, JSON, DJI SRT) and aligns
GPS/IMU trajectory with camera poses for georeferencing the reconstructed
3D model.
"""

import json
import csv
import re
import numpy as np
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class TelemetryPoint:
    """A single telemetry measurement at a point in time."""
    timestamp_ms: float
    latitude: float
    longitude: float
    altitude_m: float                       # Altitude above ground or sea level
    yaw_deg: Optional[float] = None         # Heading
    pitch_deg: Optional[float] = None
    roll_deg: Optional[float] = None
    speed_mps: Optional[float] = None       # Ground speed in m/s
    accuracy_m: Optional[float] = None      # Horizontal GPS accuracy


@dataclass
class FlightTrajectory:
    """Complete flight trajectory parsed from telemetry."""
    points: list[TelemetryPoint]
    source_file: str
    source_format: str
    coordinate_system: str = "WGS84"

    @property
    def duration_s(self) -> float:
        if len(self.points) < 2:
            return 0.0
        return (self.points[-1].timestamp_ms - self.points[0].timestamp_ms) / 1000.0

    @property
    def mean_altitude(self) -> float:
        return float(np.mean([p.altitude_m for p in self.points]))

    @property
    def bounding_box(self) -> dict:
        lats = [p.latitude for p in self.points]
        lons = [p.longitude for p in self.points]
        alts = [p.altitude_m for p in self.points]
        return {
            "min_lat": min(lats), "max_lat": max(lats),
            "min_lon": min(lons), "max_lon": max(lons),
            "min_alt": min(alts), "max_alt": max(alts),
        }

    def interpolate(self, timestamp_ms: float) -> "TelemetryPoint":
        """Return a TelemetryPoint linearly interpolated at timestamp_ms.

        If timestamp_ms is before the first point or after the last, returns the
        nearest endpoint (clamped). All float fields (lat, lon, alt, yaw, pitch,
        roll, speed) are linearly interpolated; None fields remain None.
        """
        if not self.points:
            raise ValueError("Cannot interpolate: FlightTrajectory has no points.")
        if len(self.points) == 1:
            return self.points[0]

        # Clamp to range
        if timestamp_ms <= self.points[0].timestamp_ms:
            return self.points[0]
        if timestamp_ms >= self.points[-1].timestamp_ms:
            return self.points[-1]

        # Binary search for surrounding pair
        lo, hi = 0, len(self.points) - 1
        while lo + 1 < hi:
            mid = (lo + hi) // 2
            if self.points[mid].timestamp_ms <= timestamp_ms:
                lo = mid
            else:
                hi = mid

        p0, p1 = self.points[lo], self.points[hi]
        span = p1.timestamp_ms - p0.timestamp_ms
        t = (timestamp_ms - p0.timestamp_ms) / span if span > 0 else 0.0

        def _lerp(a, b):
            if a is None or b is None:
                return a  # can't interpolate None fields
            return a + t * (b - a)

        return TelemetryPoint(
            timestamp_ms=timestamp_ms,
            latitude=_lerp(p0.latitude, p1.latitude),
            longitude=_lerp(p0.longitude, p1.longitude),
            altitude_m=_lerp(p0.altitude_m, p1.altitude_m),
            yaw_deg=_lerp(p0.yaw_deg, p1.yaw_deg),
            pitch_deg=_lerp(p0.pitch_deg, p1.pitch_deg),
            roll_deg=_lerp(p0.roll_deg, p1.roll_deg),
            speed_mps=_lerp(p0.speed_mps, p1.speed_mps),
        )



class TelemetryParser:
    """
    Parses drone flight telemetry from multiple formats:
    - CSV (generic columns: timestamp, lat, lon, alt, yaw, pitch, roll)
    - JSON (array of telemetry records)
    - DJI SRT subtitle files (embedded GPS in subtitle tracks)
    """

    # Common column name mappings
    COLUMN_ALIASES = {
        "timestamp": ["timestamp", "time", "time_ms", "timestamp_ms", "t"],
        "latitude": ["latitude", "lat", "gps_lat", "GPS.latitude"],
        "longitude": ["longitude", "lon", "lng", "gps_lon", "GPS.longitude"],
        "altitude": ["altitude", "alt", "height", "gps_alt", "altitude_m",
                      "GPS.altitude", "relative_alt", "abs_alt"],
        "yaw": ["yaw", "heading", "yaw_deg", "compass_heading", "gimbal_yaw"],
        "pitch": ["pitch", "pitch_deg", "gimbal_pitch"],
        "roll": ["roll", "roll_deg", "gimbal_roll"],
        "speed": ["speed", "ground_speed", "speed_mps", "velocity"],
    }

    def parse(self, filepath: str) -> FlightTrajectory:
        """Auto-detect format and parse telemetry file."""
        filepath = str(Path(filepath).resolve())
        ext = Path(filepath).suffix.lower()

        if ext == ".csv":
            return self._parse_csv(filepath)
        elif ext == ".json":
            return self._parse_json(filepath)
        elif ext == ".srt":
            return self._parse_dji_srt(filepath)
        else:
            raise ValueError(f"Unsupported telemetry format: {ext}")

    def _resolve_column(self, headers: list[str], field_name: str) -> Optional[int]:
        """Find column index matching a field name from known aliases."""
        aliases = self.COLUMN_ALIASES.get(field_name, [field_name])
        for alias in aliases:
            for i, h in enumerate(headers):
                if h.strip().lower() == alias.lower():
                    return i
        return None

    def _parse_csv(self, filepath: str) -> FlightTrajectory:
        """Parse generic CSV telemetry."""
        points = []
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            headers = next(reader)
            headers = [h.strip() for h in headers]

            # Resolve column indices
            cols = {}
            for field_name in ["timestamp", "latitude", "longitude", "altitude",
                               "yaw", "pitch", "roll", "speed"]:
                cols[field_name] = self._resolve_column(headers, field_name)

            if cols["latitude"] is None or cols["longitude"] is None:
                raise ValueError(f"Cannot find lat/lon columns in: {headers}")

            for row_idx, row in enumerate(reader):
                try:
                    lat = float(row[cols["latitude"]])
                    lon = float(row[cols["longitude"]])
                    alt = float(row[cols["altitude"]]) if cols["altitude"] is not None else 0.0

                    ts = float(row[cols["timestamp"]]) if cols["timestamp"] is not None else row_idx * 500.0
                    yaw = float(row[cols["yaw"]]) if cols["yaw"] is not None else None
                    pitch = float(row[cols["pitch"]]) if cols["pitch"] is not None else None
                    roll = float(row[cols["roll"]]) if cols["roll"] is not None else None
                    speed = float(row[cols["speed"]]) if cols["speed"] is not None else None

                    points.append(TelemetryPoint(
                        timestamp_ms=ts, latitude=lat, longitude=lon,
                        altitude_m=alt, yaw_deg=yaw, pitch_deg=pitch,
                        roll_deg=roll, speed_mps=speed,
                    ))
                except (ValueError, IndexError):
                    continue

        return FlightTrajectory(points=points, source_file=filepath, source_format="csv")

    def _parse_json(self, filepath: str) -> FlightTrajectory:
        """Parse JSON telemetry (array of records)."""
        with open(filepath, "r") as f:
            data = json.load(f)

        if isinstance(data, dict):
            # Try common wrapper keys
            for key in ["telemetry", "data", "points", "records", "trajectory"]:
                if key in data:
                    data = data[key]
                    break

        points = []
        for i, record in enumerate(data):
            try:
                lat = record.get("latitude") or record.get("lat")
                lon = record.get("longitude") or record.get("lon") or record.get("lng")
                alt = record.get("altitude") or record.get("alt") or record.get("height") or 0.0
                ts = record.get("timestamp") or record.get("time") or record.get("timestamp_ms") or i * 500.0

                points.append(TelemetryPoint(
                    timestamp_ms=float(ts),
                    latitude=float(lat),
                    longitude=float(lon),
                    altitude_m=float(alt),
                    yaw_deg=record.get("yaw"),
                    pitch_deg=record.get("pitch"),
                    roll_deg=record.get("roll"),
                    speed_mps=record.get("speed"),
                ))
            except (TypeError, ValueError):
                continue

        return FlightTrajectory(points=points, source_file=filepath, source_format="json")

    def _parse_dji_srt(self, filepath: str) -> FlightTrajectory:
        """Parse DJI subtitle (.srt) files with embedded GPS data.

        Supports both the legacy single-line format:
            [latitude: X] [longitude: Y] [altitude: Z]
        and the new DJI format with any field ordering. Fields are matched
        independently so ordering in the SRT subtitle block does not matter.
        """
        with open(filepath, "r") as f:
            content = f.read()

        # Match each field independently — order-insensitive
        # Handles formats like:
        #   [latitude: 28.612] [longitude: 77.209] [altitude: 45.2m]
        #   [altitude: 45.2m] [latitude: 28.612] [longitude: 77.209]
        #   [abs_alt: 45.2] [rel_alt: 12.4] [latitude: 28.612] [longitude: 77.209]
        _field = lambda key: re.compile(
            r'\[' + key + r':\s*([-\d.]+)\s*m?\]',
            re.IGNORECASE,
        )
        lat_pattern   = _field(r'latitude')
        lon_pattern   = _field(r'longitude')
        alt_pattern   = _field(r'(?:altitude|abs_alt|rel_alt)')
        yaw_pattern   = _field(r'yaw')
        pitch_pattern = _field(r'pitch')
        roll_pattern  = _field(r'roll')

        # Timestamp pattern: HH:MM:SS,mmm --> HH:MM:SS,mmm
        time_pattern = re.compile(r'(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->')

        points = []
        blocks = content.split("\n\n")

        for block in blocks:
            lat_m   = lat_pattern.search(block)
            lon_m   = lon_pattern.search(block)
            alt_m   = alt_pattern.search(block)

            # Need at minimum lat + lon to form a usable point
            if not (lat_m and lon_m):
                continue

            lat = float(lat_m.group(1))
            lon = float(lon_m.group(1))
            alt = float(alt_m.group(1)) if alt_m else 0.0

            yaw   = float(yaw_pattern.search(block).group(1))   if yaw_pattern.search(block)   else None
            pitch = float(pitch_pattern.search(block).group(1)) if pitch_pattern.search(block) else None
            roll  = float(roll_pattern.search(block).group(1))  if roll_pattern.search(block)  else None

            ts = 0.0
            time_match = time_pattern.search(block)
            if time_match:
                h, m, s, ms = (int(time_match.group(i)) for i in range(1, 5))
                ts = (h * 3600 + m * 60 + s) * 1000.0 + ms

            points.append(TelemetryPoint(
                timestamp_ms=ts, latitude=lat, longitude=lon, altitude_m=alt,
                yaw_deg=yaw, pitch_deg=pitch, roll_deg=roll,
            ))

        return FlightTrajectory(points=points, source_file=filepath, source_format="dji_srt")



class TrajectoryAligner:
    """
    Aligns estimated camera poses (from 3D reconstruction) with
    GPS/IMU trajectory for georeferencing.
    
    Uses least-squares rigid body transformation (rotation + translation + scale)
    to map the local reconstruction coordinate frame to world/geo coordinates.
    """

    @staticmethod
    def gps_to_local_enu(points: list[TelemetryPoint]) -> np.ndarray:
        """
        Convert GPS (lat/lon/alt) to local East-North-Up (ENU) coordinates
        centered at the first point.
        
        Returns Nx3 array of ENU positions in meters.
        """
        if not points:
            return np.array([])

        # Reference point (origin)
        ref_lat = np.radians(points[0].latitude)
        ref_lon = np.radians(points[0].longitude)
        ref_alt = points[0].altitude_m

        R_EARTH = 6_378_137.0  # WGS84 semi-major axis

        enu = []
        for p in points:
            dlat = np.radians(p.latitude) - ref_lat
            dlon = np.radians(p.longitude) - ref_lon
            dalt = p.altitude_m - ref_alt

            east = R_EARTH * dlon * np.cos(ref_lat)
            north = R_EARTH * dlat
            up = dalt

            enu.append([east, north, up])

        return np.array(enu)

    @staticmethod
    def compute_rigid_transform(
        source: np.ndarray, target: np.ndarray
    ) -> tuple[np.ndarray, np.ndarray, float]:
        """
        Compute optimal rigid body transformation (rotation, translation, scale)
        that maps source points to target points using SVD.
        
        Args:
            source: Nx3 array of points in reconstruction coordinate frame
            target: Nx3 array of corresponding GPS-derived ENU points
            
        Returns:
            (rotation_3x3, translation_3x1, scale_factor)
        """
        assert source.shape == target.shape
        n = source.shape[0]

        # Centroids
        centroid_src = source.mean(axis=0)
        centroid_tgt = target.mean(axis=0)

        # Center the points
        src_centered = source - centroid_src
        tgt_centered = target - centroid_tgt

        # Scale factor
        scale = np.sqrt(np.sum(tgt_centered ** 2) / np.sum(src_centered ** 2))

        # Rotation via SVD
        H = src_centered.T @ tgt_centered
        U, S, Vt = np.linalg.svd(H)
        R = Vt.T @ U.T

        # Handle reflection case
        if np.linalg.det(R) < 0:
            Vt[-1, :] *= -1
            R = Vt.T @ U.T

        # Translation
        t = centroid_tgt - scale * (R @ centroid_src)

        return R, t, scale

    def align_reconstruction(
        self,
        camera_positions: np.ndarray,
        trajectory: FlightTrajectory,
        frame_timestamps: list[float],
    ) -> tuple[np.ndarray, np.ndarray, float]:
        """
        Align reconstructed camera positions to GPS trajectory.
        
        Interpolates GPS trajectory to match frame timestamps,
        then computes the rigid transformation.
        
        Args:
            camera_positions: Nx3 array of estimated camera positions
            trajectory: Parsed GPS/IMU flight trajectory
            frame_timestamps: Timestamps (ms) of each frame
            
        Returns:
            (rotation, translation, scale) transformation parameters
        """
        # Convert GPS to local ENU
        enu_points = self.gps_to_local_enu(trajectory.points)
        gps_timestamps = np.array([p.timestamp_ms for p in trajectory.points])

        # Interpolate GPS positions at frame timestamps
        frame_ts = np.array(frame_timestamps)
        interp_east = np.interp(frame_ts, gps_timestamps, enu_points[:, 0])
        interp_north = np.interp(frame_ts, gps_timestamps, enu_points[:, 1])
        interp_up = np.interp(frame_ts, gps_timestamps, enu_points[:, 2])
        gps_at_frames = np.stack([interp_east, interp_north, interp_up], axis=1)

        # Compute rigid alignment
        R, t, s = self.compute_rigid_transform(camera_positions, gps_at_frames)
        return R, t, s

    def transform_points(
        self, points: np.ndarray, R: np.ndarray, t: np.ndarray, scale: float
    ) -> np.ndarray:
        """Apply rigid transform (scale * R @ p + t) to a point cloud."""
        return (scale * (R @ points.T)).T + t
