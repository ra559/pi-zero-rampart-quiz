#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec rampart server.js
