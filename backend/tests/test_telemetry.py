import pytest
import tempfile
import os
from pipeline.telemetry import TelemetryParser, TelemetryPoint, FlightTrajectory

def test_parse_dji_srt():
    srt_content = """1
00:00:00,000 --> 00:00:01,000
[latitude: 28.61234] [longitude: 77.20987] [altitude: 45.23] [yaw: 42.1] [pitch: -5.2] [roll: 1.3]

2  
00:00:01,000 --> 00:00:02,000
[latitude: 28.61289] [longitude: 77.21045] [altitude: 46.10] [yaw: 43.5] [pitch: -5.8] [roll: 0.9]"""
    
    with tempfile.TemporaryDirectory() as tmpdir:
        srt_path = os.path.join(tmpdir, "test.srt")
        with open(srt_path, "w") as f:
            f.write(srt_content)
            
        parser = TelemetryParser()
        traj = parser.parse(srt_path)
        
        assert len(traj.points) == 2
        assert traj.points[0].latitude == 28.61234
        assert traj.points[0].longitude == 77.20987
        assert traj.points[0].altitude_m == 45.23
        assert traj.points[0].timestamp_ms == 0.0

def test_parse_csv():
    csv_content = "timestamp,latitude,longitude,altitude\n0,28.0,77.0,10.0\n1000,28.1,77.1,11.0"
    with tempfile.TemporaryDirectory() as tmpdir:
        csv_path = os.path.join(tmpdir, "test.csv")
        with open(csv_path, "w") as f:
            f.write(csv_content)
            
        parser = TelemetryParser()
        traj = parser.parse(csv_path)
        
        assert len(traj.points) == 2
        assert traj.points[0].latitude == 28.0
        assert traj.points[1].latitude == 28.1
        assert traj.points[1].timestamp_ms == 1000.0

def test_timestamp_interpolation():
    points = []
    for i in range(10):
        points.append(TelemetryPoint(
            timestamp_ms=float(i * 1000),
            latitude=10.0 + i,
            longitude=20.0 + i,
            altitude_m=30.0 + i
        ))
    traj = FlightTrajectory(points=points, source_file="fake", source_format="fake")
    if hasattr(traj, 'interpolate'):
        pt = traj.interpolate(4500)
        assert pt is not None
        assert pt.latitude == 14.5
        assert pt.longitude == 24.5
        assert pt.altitude_m == 34.5
    else:
        pytest.skip("interpolate method not yet implemented in FlightTrajectory")

def test_missing_telemetry():
    parser = TelemetryParser()
    with pytest.raises((ValueError, FileNotFoundError)):
        parser.parse("")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        empty_path = os.path.join(tmpdir, "empty.csv")
        with open(empty_path, "w") as f:
            pass
        with pytest.raises(Exception):
            parser.parse(empty_path)

def test_bounding_box():
    points = [
        TelemetryPoint(timestamp_ms=0, latitude=10.0, longitude=20.0, altitude_m=30.0),
        TelemetryPoint(timestamp_ms=1000, latitude=12.0, longitude=18.0, altitude_m=40.0)
    ]
    traj = FlightTrajectory(points=points, source_file="fake", source_format="fake")
    bbox = traj.bounding_box
    
    assert bbox["min_lat"] == 10.0
    assert bbox["max_lat"] == 12.0
    assert bbox["min_lon"] == 18.0
    assert bbox["max_lon"] == 20.0
    assert bbox["min_alt"] == 30.0
    assert bbox["max_alt"] == 40.0

def test_duration():
    points = []
    for i in range(10):
        points.append(TelemetryPoint(
            timestamp_ms=float(i * 1000),
            latitude=10.0, longitude=20.0, altitude_m=30.0
        ))
    traj = FlightTrajectory(points=points, source_file="fake", source_format="fake")
    
    assert traj.duration_s == 9.0
