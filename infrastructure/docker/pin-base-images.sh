#!/usr/bin/env bash
# Upgradability follow-up: Docker base images were pinned by TAG
# (node:20-alpine, nginx:1.27-alpine), and a tag can move — the same tag
# name can silently point at a different image tomorrow, which is exactly
# what Dependabot's new "docker" ecosystem entry (.github/dependabot.yml)
# is meant to catch and open a PR for, but only once there's an actual
# digest in the Dockerfile for it to bump.
#
# This sandbox has no network path to Docker Hub's registry (verified:
# a direct request to registry-1.docker.io is blocked here), so real
# digests can't be resolved or fabricated from here — a wrong/guessed
# digest would break every build permanently, which is worse than an
# unpinned tag. Run this ON A MACHINE WITH DOCKER + NETWORK ACCESS once,
# commit the result, and Dependabot takes it from there.
set -euo pipefail

resolve() {
  local image="$1"
  echo "Resolving digest for ${image} ..."
  docker pull "${image}" >/dev/null
  docker inspect --format='{{index .RepoDigests 0}}' "${image}"
}

echo "node:20-alpine       -> $(resolve node:20-alpine)"
echo "nginx:1.27-alpine    -> $(resolve nginx:1.27-alpine)"

cat <<'EOF'

Next steps:
  1. Copy each "<repo>@sha256:<digest>" value above.
  2. In backend.Dockerfile, replace both `FROM node:20-alpine` lines with
     `FROM node:20-alpine@sha256:<digest>`.
  3. In frontend.Dockerfile, replace `FROM node:20-alpine` and
     `FROM nginx:1.27-alpine` the same way.
  4. Commit. Dependabot's "docker" ecosystem entry will now open a PR
     whenever a newer digest is published for these tags.
EOF
