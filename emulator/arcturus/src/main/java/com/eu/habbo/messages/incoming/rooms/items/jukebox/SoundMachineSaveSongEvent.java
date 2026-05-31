package com.eu.habbo.messages.incoming.rooms.items.jukebox;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionMusicDisc;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.eu.habbo.messages.outgoing.inventory.AddHabboItemComposer;
import com.eu.habbo.messages.outgoing.inventory.InventoryRefreshComposer;
import com.eu.habbo.messages.outgoing.rooms.items.jukebox.JukeBoxMySongsComposer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Calendar;
import java.util.List;
import java.util.stream.Collectors;

public class SoundMachineSaveSongEvent extends MessageHandler {
    private static final Logger LOGGER = LoggerFactory.getLogger(SoundMachineSaveSongEvent.class);

    @Override
    public void handle() throws Exception {
        String songName = this.packet.readString();
        String trackData = this.packet.readString();

        if (songName == null || songName.trim().isEmpty() || trackData == null || trackData.trim().isEmpty()) {
            return;
        }

        songName = songName.trim();
        if (songName.length() > 64) {
            songName = songName.substring(0, 64);
        }

        Habbo habbo = this.client.getHabbo();
        if (habbo == null) return;

        String username = habbo.getHabboInfo().getUsername();
        String code = (username + "_" + songName).toLowerCase().replace(" ", "_").replaceAll("[^a-z0-9_]", "");

        // Compute a rough length from the track data (sum of all channel item lengths for channel 1)
        int length = computeTrackLength(trackData);

        // Insert the new soundtrack into the database
        int newSongId = insertSoundtrack(code, songName, username, trackData, length);
        if (newSongId <= 0) {
            LOGGER.error("Failed to insert soundtrack for user {}", username);
            return;
        }

        // Reload soundtracks cache so the new entry is available
        Emulator.getGameEnvironment().getItemManager().loadSoundTracks();

        // Find the base item for music discs
        Item baseItem = Emulator.getGameEnvironment().getItemManager().getItem("song_disk");
        if (baseItem == null) {
            // Fallback: find any item with musicdisc interaction type
            baseItem = findMusicDiscBaseItem();
        }
        if (baseItem == null) {
            LOGGER.error("Could not find a musicdisc base item to create the disc for user {}", username);
            return;
        }

        // Build extradata: username\nday\nmonth\nyear\nlength\nsongName\nsongId
        Calendar cal = Calendar.getInstance();
        String extradata = username + "\n"
                + cal.get(Calendar.DAY_OF_MONTH) + "\n"
                + (cal.get(Calendar.MONTH) + 1) + "\n"
                + cal.get(Calendar.YEAR) + "\n"
                + length + "\n"
                + songName + "\n"
                + newSongId;

        // Create the item and add to inventory
        HabboItem disc = Emulator.getGameEnvironment().getItemManager().createItem(
                habbo.getHabboInfo().getId(), baseItem, 0, 0, extradata);

        if (disc == null) {
            LOGGER.error("Failed to create musicdisc item for user {}", username);
            return;
        }

        disc.needsUpdate(true);
        Emulator.getThreading().run(disc);

        habbo.getInventory().getItemsComponent().addItem(disc);
        this.client.sendResponse(new AddHabboItemComposer(disc));
        this.client.sendResponse(new InventoryRefreshComposer());

        // Refresh the disc inventory so the UI updates
        List<InteractionMusicDisc> discs = habbo.getInventory().getItemsComponent().getItems()
                .valueCollection().stream()
                .filter(i -> i instanceof InteractionMusicDisc && i.getRoomId() == 0)
                .map(i -> (InteractionMusicDisc) i)
                .collect(Collectors.toList());
        this.client.sendResponse(new JukeBoxMySongsComposer(discs));
    }

    private int insertSoundtrack(String code, String name, String author, String track, int length) {
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO soundtracks (code, name, author, track, length) VALUES (?, ?, ?, ?, ?)",
                     Statement.RETURN_GENERATED_KEYS)) {
            statement.setString(1, code);
            statement.setString(2, name);
            statement.setString(3, author);
            statement.setString(4, track);
            statement.setInt(5, length);
            statement.execute();
            try (ResultSet keys = statement.getGeneratedKeys()) {
                if (keys.next()) {
                    return keys.getInt(1);
                }
            }
        } catch (SQLException e) {
            LOGGER.error("Caught SQL exception while inserting soundtrack", e);
        }
        return -1;
    }

    private int computeTrackLength(String trackData) {
        // Parse the first channel and sum item lengths to get a rough total length value
        int total = 0;
        try {
            String[] parts = trackData.split(":");
            for (int i = 0; i + 1 < parts.length; i += 2) {
                if (parts[i].trim().isEmpty()) continue;
                String[] items = parts[i + 1].split(";");
                int channelTotal = 0;
                for (String item : items) {
                    if (item.trim().isEmpty()) continue;
                    String[] pair = item.split(",");
                    if (pair.length == 2) {
                        channelTotal += Integer.parseInt(pair[1].trim());
                    }
                }
                if (channelTotal > total) total = channelTotal;
            }
        } catch (Exception e) {
            LOGGER.warn("Could not compute track length, defaulting to 32", e);
            return 32;
        }
        return total > 0 ? total : 32;
    }

    private Item findMusicDiscBaseItem() {
        gnu.trove.iterator.TIntObjectIterator<Item> iter =
                Emulator.getGameEnvironment().getItemManager().getItems().iterator();
        int size = Emulator.getGameEnvironment().getItemManager().getItems().size();
        for (int i = size; i-- > 0; ) {
            try {
                iter.advance();
                Item item = iter.value();
                if (item.getInteractionType() != null
                        && item.getInteractionType().getType() == InteractionMusicDisc.class) {
                    return item;
                }
            } catch (java.util.NoSuchElementException e) {
                break;
            }
        }
        return null;
    }
}
