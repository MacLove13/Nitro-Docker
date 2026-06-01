package com.eu.habbo.habbohotel.items.interactions.wired.effects;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionWiredEffect;
import com.eu.habbo.habbohotel.items.interactions.InteractionWiredTrigger;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.wired.WiredEffectType;
import com.eu.habbo.habbohotel.wired.WiredHandler;
import com.eu.habbo.habbohotel.wired.WiredTriggerType;
import com.eu.habbo.messages.ClientMessage;
import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.wired.WiredSaveException;
import gnu.trove.procedure.TObjectProcedure;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class WiredEffectGiveUserVariable extends InteractionWiredEffect {
    private static final Logger LOGGER = LoggerFactory.getLogger(WiredEffectGiveUserVariable.class);

    public static final WiredEffectType type = WiredEffectType.GIVE_USER_VARIABLE;

    private String variableName = "";
    private String valueToSet = "0";

    public WiredEffectGiveUserVariable(ResultSet set, Item baseItem) throws SQLException {
        super(set, baseItem);
    }

    public WiredEffectGiveUserVariable(int id, int userId, Item item, String extradata, int limitedStack, int limitedSells) {
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
        Habbo habbo = room.getHabbo(roomUnit);

        if (habbo == null || variableName.isEmpty()) return false;

        int roomId = room.getId();
        int userId = habbo.getHabboInfo().getId();

        try (Connection connection = Emulator.getDatabase().getDataSource().getConnection()) {
            if (!variableDefinitionExists(connection, roomId)) return false;
            upsertUserVariableValue(connection, roomId, userId, valueToSet);
        } catch (SQLException e) {
            LOGGER.error("Failed to give user variable '{}' to user {} in room {}", variableName, userId, roomId, e);
            return false;
        }

        WiredHandler.handle(WiredTriggerType.USER_VARIABLE_CHANGED, roomUnit, room, new Object[]{variableName});

        return true;
    }

    private boolean variableDefinitionExists(Connection connection, int roomId) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(
                "SELECT 1 FROM wired_variable_definitions WHERE room_id = ? AND variable_name = ? LIMIT 1")) {
            stmt.setInt(1, roomId);
            stmt.setString(2, variableName);
            try (ResultSet rs = stmt.executeQuery()) {
                return rs.next();
            }
        }
    }

    private void upsertUserVariableValue(Connection connection, int roomId, int userId, String value) throws SQLException {
        try (PreparedStatement stmt = connection.prepareStatement(
                "INSERT INTO wired_user_variable_values (room_id, user_id, variable_name, value) " +
                "VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)")) {
            stmt.setInt(1, roomId);
            stmt.setInt(2, userId);
            stmt.setString(3, variableName);
            stmt.setString(4, value);
            stmt.executeUpdate();
        }
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

    @Override
    public String getWiredData() {
        return WiredHandler.getGsonBuilder().create().toJson(
                new JsonData(variableName, valueToSet, getDelay()));
    }

    @Override
    public void loadWiredData(ResultSet set, Room room) throws SQLException {
        String wiredData = set.getString("wired_data");

        if (wiredData.startsWith("{")) {
            JsonData data = WiredHandler.getGsonBuilder().create().fromJson(wiredData, JsonData.class);
            this.variableName = data.variableName != null ? data.variableName : "";
            this.valueToSet = data.valueToSet != null ? data.valueToSet : "0";
            this.setDelay(data.delay);
        }
    }

    @Override
    public void onPickUp() {
        this.variableName = "";
        this.valueToSet = "0";
        this.setDelay(0);
    }

    @Override
    public void serializeWiredData(ServerMessage message, Room room) {
        List<String> availableVars = loadAvailableVariables(room.getId());
        String varList = availableVars.stream().collect(Collectors.joining(","));

        message.appendBoolean(false);
        message.appendInt(0);
        message.appendInt(0);
        message.appendInt(this.getBaseItem().getSpriteId());
        message.appendInt(this.getId());
        message.appendString(variableName + "\t" + valueToSet + "\t" + varList);
        message.appendInt(0);
        message.appendInt(0);
        message.appendInt(type.code);
        message.appendInt(this.getDelay());

        if (this.requiresTriggeringUser()) {
            List<Integer> invalidTriggers = new ArrayList<>();
            room.getRoomSpecialTypes().getTriggers(this.getX(), this.getY()).forEach(new TObjectProcedure<InteractionWiredTrigger>() {
                @Override
                public boolean execute(InteractionWiredTrigger object) {
                    if (!object.isTriggeredByRoomUnit()) {
                        invalidTriggers.add(object.getBaseItem().getSpriteId());
                    }
                    return true;
                }
            });
            message.appendInt(invalidTriggers.size());
            for (Integer i : invalidTriggers) {
                message.appendInt(i);
            }
        } else {
            message.appendInt(0);
        }
    }

    @Override
    public boolean saveData(ClientMessage packet, GameClient gameClient) throws WiredSaveException {
        packet.readInt();

        String rawString = packet.readString();
        String[] parts = rawString.split("\t", -1);

        if (parts.length < 2) throw new WiredSaveException("Invalid data for GiveUserVariable");

        String name = parts[0].trim();
        if (name.isEmpty()) throw new WiredSaveException("Variable name cannot be empty");
        if (name.length() > 100) throw new WiredSaveException("Variable name too long");

        String value = parts[1].trim();

        packet.readInt();

        int delay = packet.readInt();
        if (delay > Emulator.getConfig().getInt("hotel.wired.max_delay", 20))
            throw new WiredSaveException("Delay too long");

        this.variableName = name;
        this.valueToSet = value;
        this.setDelay(delay);

        return true;
    }

    @Override
    public WiredEffectType getType() {
        return type;
    }

    @Override
    public boolean requiresTriggeringUser() {
        return true;
    }

    static class JsonData {
        String variableName;
        String valueToSet;
        int delay;

        public JsonData(String variableName, String valueToSet, int delay) {
            this.variableName = variableName;
            this.valueToSet = valueToSet;
            this.delay = delay;
        }
    }
}
