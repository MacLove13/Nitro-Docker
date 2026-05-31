package com.eu.habbo.messages.incoming.camera;

import com.eu.habbo.Emulator;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.eu.habbo.messages.outgoing.camera.CameraRoomThumbnailSavedComposer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import io.netty.buffer.ByteBufUtil;
import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;

public class CameraRoomThumbnailEvent extends MessageHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(CameraRoomThumbnailEvent.class);

    @Override
    public void handle() throws Exception {
        if (!this.client.getHabbo().hasPermission("acc_camera")) {
            this.client.getHabbo().alert(Emulator.getTexts().getValue("camera.permission"));
            return;
        }

        if (!this.client.getHabbo().getHabboInfo().getCurrentRoom().isOwner(this.client.getHabbo()))
            return;

        // Read length prefix then raw PNG bytes sent by Nitro React
        this.packet.getBuffer().readInt();
        byte[] pngData = ByteBufUtil.getBytes(this.packet.getBuffer());

        int userId = this.client.getHabbo().getHabboInfo().getId();
        int timestamp = Emulator.getIntUnixTimestamp();
        String filename = userId + "_" + timestamp + "_thumb.png";

        String thumbnailDir = Emulator.getConfig().getValue("imager.location.output.thumbnail", "/var/www/html/public/camera/thumbnail/");
        new File(thumbnailDir).mkdirs();

        try {
            BufferedImage original = ImageIO.read(new ByteArrayInputStream(pngData));
            if (original != null) {
                BufferedImage thumb = new BufferedImage(110, 110, BufferedImage.TYPE_INT_ARGB);
                Graphics2D g2d = thumb.createGraphics();
                g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g2d.drawImage(original, 0, 0, 110, 110, null);
                g2d.dispose();
                ImageIO.write(thumb, "png", new File(thumbnailDir, filename));
                LOGGER.info("[Camera] Saved thumbnail: " + filename + " for user " + userId);
            }
        } catch (Exception e) {
            LOGGER.error("[Camera] Failed to save room thumbnail: " + e.getMessage());
        }

        this.client.sendResponse(new CameraRoomThumbnailSavedComposer());
    }
}