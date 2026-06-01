package com.eu.habbo.habbohotel.items.interactions.wired.triggers;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionWiredTrigger;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.wired.WiredHandler;
import com.eu.habbo.habbohotel.wired.WiredTriggerType;
import com.eu.habbo.messages.ClientMessage;
import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.wired.WiredSaveException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class WiredTriggerUserVariableChanged extends InteractionWiredTrigger {
    private static final Logger LOGGER = LoggerFactory.getLogger(WiredTriggerUserVariableChanged.class);
    public static final WiredTriggerType type = WiredTriggerType.USER_VARIABLE_CHANGED;

    private static final String DATA_DELIMITER = "\t";
    private static final String VAR_LIST_DELIMITER = ",";

    private String variableName = "";

    public WiredTriggerUserVariableChanged(ResultSet set, Item baseItem) throws SQLException {
        super(set, baseItem);
    }

    public WiredTriggerUserVariableChanged(int id, int userId, Item item, String extradata, int limitedStack, int limitedSells) {
        super(id, userId, item, extradata, limitedStack, limitedSells);
    }

    public String getVariableName() {
        return variableName;
    }

    public void updateVariableName(String newName) {
        this.variableName = newName;
        this.needsUpdate(true);
    }

    @Override
    public boolean execute(RoomUnit roomUnit, Room room, Object[] stuff) {
        if (variableName.isEmpty()) return false;
        if (stuff == null || stuff.length < 1) return false;
        if (!(stuff[0] instanceof String)) return false;
        return variableName.equals(stuff[0]);
    }

    @Override
    public String getWiredData() {
        return WiredHandler.getGsonBuilder().create().toJson(new JsonData(variableName));
    }

    @Override
    public void loadWiredData(ResultSet set, Room room) throws SQLException {
        String wiredData = set.getString("wired_data");

        if (wiredData != null && wiredData.startsWith("{")) {
            JsonData data = WiredHandler.getGsonBuilder().create().fromJson(wiredData, JsonData.class);
            this.variableName = data.variableName != null ? data.variableName : "";
        }
    }

    @Override
    public void onPickUp() {
        this.variableName = "";
    }

    @Override
    public WiredTriggerType getType() {
        return type;
    }

    @Override
    public void serializeWiredData(ServerMessage message, Room room) {
        List<String> availableVars = loadAvailableVariables(room.getId());
        String varList = String.join(VAR_LIST_DELIMITER, availableVars);

        message.appendBoolean(false);
        message.appendInt(5);
        message.appendInt(0);
        message.appendInt(this.getBaseItem().getSpriteId());
        message.appendInt(this.getId());
        message.appendString(variableName + DATA_DELIMITER + varList);
        message.appendInt(0);
        message.appendInt(1);
        message.appendInt(this.getType().code);
        message.appendInt(0);
        message.appendInt(0);
    }

    @Override
    public boolean saveData(ClientMessage packet) {
        packet.readInt();
        String rawString = packet.readString();
        String[] parts = rawString.split(DATA_DELIMITER, -1);

        String name = parts[0].trim();
        if (name.length() > 100) {
            LOGGER.warn("Variable name too long for WiredTriggerUserVariableChanged");
            return false;
        }

        this.variableName = name;
        return true;
    }

    @Override
    public boolean isTriggeredByRoomUnit() {
        return true;
    }

    private List<String> loadAvailableVariables(int roomId) {
        List<String> vars = new ArrayList<>();
        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection();
             PreparedStatement stmt = connection.prepareStatement(
                     "SELECT variable_name FROM wired_variable_definitions WHERE room_id = ? ORDER BY variable_name")) {
            stmt.setInt(1, roomId);
            try (ResultSet rs = stmt.executeQuery()) {
                while (rs.next()) {
                    vars.add(rs.getString("variable_name"));
                }
            }
        } catch (SQLException e) {
            LOGGER.error("Failed to load available variables for room {}", roomId, e);
        }
        return vars;
    }

    static class JsonData {
        String variableName;

        public JsonData(String variableName) {
            this.variableName = variableName;
        }
    }
}
