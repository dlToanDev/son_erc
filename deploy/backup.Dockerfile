# Image cho service `backup`: postgres:16 (có pg_dump) + rclone (đẩy backup lên cloud).
FROM postgres:16
RUN apt-get update \
  && apt-get install -y --no-install-recommends rclone ca-certificates \
  && rm -rf /var/lib/apt/lists/*
