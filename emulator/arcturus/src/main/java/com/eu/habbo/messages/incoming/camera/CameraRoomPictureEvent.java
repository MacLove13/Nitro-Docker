package com.eu.habbo.messages.incoming.camera;

import com.eu.habbo.Emulator;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.eu.habbo.messages.outgoing.camera.CameraURLComposer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.netty.buffer.ByteBufUtil;
import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;

public class CameraRoomPictureEvent extends MessageHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(CameraRoomPictureEvent.class);

    @Override
    public void handle() throws Exception {
        if (!this.client.getHabbo().hasPermission("acc_camera")) {
            this.client.getHabbo().alert(Emulator.getTexts().getValue("camera.permission"));
            return;
        }

        // Read length prefix then raw PNG bytes sent by Nitro React
        this.packet.getBuffer().readInt();
        byte[] pngData = ByteBufUtil.getBytes(this.packet.getBuffer());

        int userId = this.client.getHabbo().getHabboInfo().getId();
        int timestamp = Emulator.getIntUnixTimestamp();
        String filename = userId + "_" + timestamp + ".png";
        String smallFilename = userId + "_" + timestamp + "_small.png";

        String outputDir = Emulator.getConfig().getValue("imager.location.output.camera", "/var/www/html/public/camera/");
        String thumbnailDir = Emulator.getConfig().getValue("imager.location.output.thumbnail", "/var/www/html/public/camera/thumbnail/");

        new File(outputDir).mkdirs();
        new File(thumbnailDir).mkdirs();

        // Save original PNG
        Files.write(Paths.get(outputDir, filename), pngData);

        // Save small thumbnail (half size)
        try {
            BufferedImage original = ImageIO.read(new ByteArrayInputStream(pngData));
            if (original != null) {
                int tw = Math.max(1, original.getWidth() / 2);
                int th = Math.max(1, original.getHeight() / 2);
                BufferedImage small = new BufferedImage(tw, th, BufferedImage.TYPE_INT_ARGB);
                Graphics2D g2d = small.createGraphics();
                g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g2d.drawImage(original, 0, 0, tw, th, null);
                g2d.dispose();
                ImageIO.write(small, "png", new File(outputDir, smallFilename));
            }
        } catch (Exception e) {
            LOGGER.error("[Camera] Failed to save thumbnail: " + e.getMessage());
        }

        // Store photo metadata
        int roomId = this.client.getHabbo().getHabboInfo().getCurrentRoom() != null
                ? this.client.getHabbo().getHabboInfo().getCurrentRoom().getId() : 0;
        String cameraUrl = Emulator.getConfig().getValue("camera.url", "http://localhost:8082/camera/");
        if (!cameraUrl.endsWith("/")) cameraUrl += "/";
        String extraData = Emulator.getConfig().getValue("camera.extradata")
                .replace("%timestamp%", timestamp + "")
                .replace("%id%", userId + "")
                .replace("%room_id%", roomId + "")
                .replace("%url%", cameraUrl + filename);

        this.client.getHabbo().getHabboInfo().setPhotoJSON(extraData);
        this.client.getHabbo().getHabboInfo().setPhotoTimestamp(timestamp);
        if (roomId > 0) {
            this.client.getHabbo().getHabboInfo().setPhotoRoomId(roomId);
        }

        LOGGER.info("[Camera] Saved photo: " + filename + " for user " + userId);
        this.client.sendResponse(new CameraURLComposer(filename));
    }
}
