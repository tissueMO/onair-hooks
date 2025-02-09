build-FFmpegLayer:
	mkdir -p "$(ARTIFACTS_DIR)/bin"
	mkdir -p "$(ARTIFACTS_DIR)/ffmpeg"
	curl -L -o "$(ARTIFACTS_DIR)/ffmpeg.tar.xz" https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
	tar xvf "$(ARTIFACTS_DIR)/ffmpeg.tar.xz" --strip-components 1 -C "$(ARTIFACTS_DIR)/ffmpeg"
	cp "$(ARTIFACTS_DIR)/ffmpeg/ffmpeg" "$(ARTIFACTS_DIR)/bin/"
	rm -rf "$(ARTIFACTS_DIR)/ffmpeg.tar.xz" "$(ARTIFACTS_DIR)/ffmpeg"

build-OnAirHooksLayer:
	mkdir -p "$(ARTIFACTS_DIR)/nodejs"
	cp -R "/app/node_modules" "$(ARTIFACTS_DIR)/nodejs/"
