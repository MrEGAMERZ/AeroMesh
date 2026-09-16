# SIH26158 Pipeline Package
"""
Single-Pass Drone Video → 3D Model Reconstruction Pipeline

Modules:
    ingest           - Frame extraction & blur detection
    telemetry        - GPS/IMU telemetry parsing & trajectory alignment
    dynamic_masking  - SAM2 dynamic object masking
    reconstruction   - Feed-forward 3D transformer inference
    meshing          - Poisson surface reconstruction & UV texturing
"""
