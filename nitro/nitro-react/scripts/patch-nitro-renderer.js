const fs = require('fs');
const path = require('path');

const rendererRoot = path.join(__dirname, '..', 'node_modules', '@nitrots', 'nitro-renderer', 'src');

const file = (...parts) => path.join(rendererRoot, ...parts);

const patchFile = (relativePath, marker, replacements) =>
{
    const target = file(...relativePath.split('/'));

    if(!fs.existsSync(target))
    {
        console.warn(`[patch-nitro-renderer] ${ relativePath } not found, skipping.`);
        return;
    }

    let source = fs.readFileSync(target, 'utf8');

    if(source.includes(marker)) return;

    for(const [ pattern, replacement ] of replacements)
    {
        const updated = source.replace(pattern, replacement);

        if(updated === source)
        {
            throw new Error(`[patch-nitro-renderer] Failed to patch ${ relativePath } with pattern ${ pattern }`);
        }

        source = updated;
    }

    fs.writeFileSync(target, source, 'utf8');
    console.log(`[patch-nitro-renderer] Patched ${ relativePath }.`);
}

patchFile('nitro/communication/messages/parser/user/data/UserProfileParser.ts', 'private _health: number;', [
    [
        /private _secondsSinceLastVisit: number;\s*\n\s*private _openProfileWindow: boolean;/,
        match => `${ match }\n    private _health: number;\n    private _stamina: number;`
    ],
    [
        /this\._openProfileWindow = false;/,
        match => `${ match }\n        this._health = 100;\n        this._stamina = 100;`
    ],
    [
        /this\._openProfileWindow = wrapper\.readBoolean\(\);/,
        match => `${ match }\n        this._health = Math.max(0, Math.min(100, wrapper.readInt()));\n        this._stamina = Math.max(0, Math.min(100, wrapper.readInt()));`
    ],
    [
        /(\s+public get openProfileWindow\(\): boolean\s*\{\s*\n\s*return this\._openProfileWindow;\s*\n\s*\})/,
        match => `${ match }\n\n    public get health(): number\n    {\n        return this._health;\n    }\n\n    public get stamina(): number\n    {\n        return this._stamina;\n    }`
    ]
]);

patchFile('nitro/communication/messages/parser/room/unit/UserMessageData.ts', 'private _health: number = 100;', [
    [
        /private _activityPoints: number = 0;/,
        match => `${ match }\n    private _health: number = 100;\n    private _stamina: number = 100;`
    ],
    [
        /(\s+public set activityPoints\(k: number\)\s*\{\s*\n\s*if\(!this\._isReadOnly\)\s*\{\s*this\._activityPoints = k;\s*\}\s*\})/,
        match => `${ match }\n\n    public get health(): number\n    {\n        return this._health;\n    }\n\n    public set health(k: number)\n    {\n        if(!this._isReadOnly)\n        {\n            this._health = k;\n        }\n    }\n\n    public get stamina(): number\n    {\n        return this._stamina;\n    }\n\n    public set stamina(k: number)\n    {\n        if(!this._isReadOnly)\n        {\n            this._stamina = k;\n        }\n    }`
    ]
]);

patchFile('nitro/communication/messages/parser/room/unit/RoomUnitParser.ts', 'user.health = Math.max(0, Math.min(100, wrapper.readInt()));', [
    [
        /user\.isModerator = wrapper\.readBoolean\(\);/,
        match => `${ match }\n                user.health = Math.max(0, Math.min(100, wrapper.readInt()));\n                user.stamina = Math.max(0, Math.min(100, wrapper.readInt()));`
    ]
]);

patchFile('nitro/communication/messages/parser/room/unit/RoomUnitInfoParser.ts', 'private _health: number;', [
    [
        /private _achievementScore: number;/,
        match => `${ match }\n    private _health: number;\n    private _stamina: number;`
    ],
    [
        /this\._achievementScore = 0;/,
        match => `${ match }\n        this._health = 100;\n        this._stamina = 100;`
    ],
    [
        /this\._achievementScore = wrapper\.readInt\(\);/,
        match => `${ match }\n        this._health = Math.max(0, Math.min(100, wrapper.readInt()));\n        this._stamina = Math.max(0, Math.min(100, wrapper.readInt()));`
    ],
    [
        /(\s+public get achievementScore\(\): number\s*\{\s*\n\s*return this\._achievementScore;\s*\n\s*\})/,
        match => `${ match }\n\n    public get health(): number\n    {\n        return this._health;\n    }\n\n    public get stamina(): number\n    {\n        return this._stamina;\n    }`
    ]
]);

patchFile('api/nitro/session/IRoomUserData.ts', 'health: number;', [
    [
        /activityPoints: number;/,
        match => `${ match }\n    health: number;\n    stamina: number;`
    ]
]);

patchFile('nitro/session/RoomUserData.ts', 'private _health: number = 100;', [
    [
        /private _activityPoints: number;/,
        match => `${ match }\n    private _health: number = 100;\n    private _stamina: number = 100;`
    ],
    [
        /(\s+public set activityPoints\(k: number\)\s*\{\s*this\._activityPoints = k;\s*\})/,
        match => `${ match }\n\n    public get health(): number\n    {\n        return this._health;\n    }\n\n    public set health(k: number)\n    {\n        this._health = k;\n    }\n\n    public get stamina(): number\n    {\n        return this._stamina;\n    }\n\n    public set stamina(k: number)\n    {\n        this._stamina = k;\n    }`
    ]
]);

patchFile('nitro/session/handler/RoomUsersHandler.ts', 'userData.health = user.health;', [
    [
        /userData\.activityPoints = user\.activityPoints;/,
        match => `${ match }\n                userData.health = user.health;\n                userData.stamina = user.stamina;`
    ],
    [
        /session\.userDataManager\.updateAchievementScore\(parser\.unitId, parser\.achievementScore\);/,
        match => `${ match }\n\n        const userData = session.userDataManager.getUserDataByIndex(parser.unitId);\n\n        if(userData)\n        {\n            userData.health = parser.health;\n            userData.stamina = parser.stamina;\n        }`
    ]
]);
