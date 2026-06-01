# WIRED Creator — Registering New Wired Furnis

This document explains exactly how to add a new WIRED furniture item to the hotel, using the **User Variable** wireds introduced in this PR as a concrete example. The same steps apply to any future wired you want to create.

---

## Overview

Every WIRED furni needs to exist in **three places**:

| Place | Purpose |
|---|---|
| `items_base` (database) | Defines the item (sprite, size, interaction type) |
| `catalog_pages` + `catalog_items` (database) | Makes it purchasable in the catalogue |
| `ItemManager.java` (emulator) | Maps the `interaction_type` string to a Java class |

The frontend only needs to know the **layout code** (an integer) to render the correct UI panel — those are already defined in `WiredActionLayoutCode.ts` / `WiredTriggerLayoutCode.ts`.

---

## Step 1 — Run the Migration SQL

Run `mysql/dumps/wired_user_variable_migration.sql` against your database. This file:

1. Creates the two new tables (`wired_variable_definitions`, `wired_user_variable_values`).
2. Contains **commented-out** `items_base` INSERT examples at the bottom.

Uncomment and execute the four `INSERT INTO items_base` statements:

```sql
-- Define User Variable (effect code 30)
INSERT INTO `items_base`
  (`id`, `sprite_id`, `item_name`, `public_name`, `type`,
   `width`, `length`, `stack_height`,
   `allow_stack`, `allow_sit`, `allow_lay`, `allow_walk`,
   `allow_gift`, `allow_trade`, `allow_recycle`,
   `allow_marketplace_sell`, `allow_inventory_stack`,
   `interaction_type`, `interaction_modes_count`,
   `vending_ids`, `is_chroma`, `customparams`,
   `effect_id_male`, `effect_id_female`, `clothing_on_walk`)
VALUES
  (NULL, 0, 'wf_act_define_user_variable', 'WIRED Effect: Define User Variable',
   's', 1, 1, 0.65,
   1, 0, 0, 1, 1, 1, 0, 0, 1,
   'wf_act_define_user_variable', 1,
   '0', 0, '', 0, 0, '');

-- Give User Variable (effect code 28)
INSERT INTO `items_base` (...)
VALUES (NULL, 0, 'wf_act_give_user_variable', 'WIRED Effect: Give User Variable', 's', 1, 1, 0.65, 1, 0, 0, 1, 1, 1, 0, 0, 1, 'wf_act_give_user_variable', 1, '0', 0, '', 0, 0, '');

-- Change User Variable (effect code 29)
INSERT INTO `items_base` (...)
VALUES (NULL, 0, 'wf_act_change_user_variable', 'WIRED Effect: Change User Variable', 's', 1, 1, 0.65, 1, 0, 0, 1, 1, 1, 0, 0, 1, 'wf_act_change_user_variable', 1, '0', 0, '', 0, 0, '');

-- User Variable Changed (trigger code 15)
INSERT INTO `items_base` (...)
VALUES (NULL, 0, 'wf_trg_user_variable_changed', 'WIRED Trigger: Variable Changed', 's', 1, 1, 0.65, 1, 0, 0, 1, 1, 1, 0, 0, 1, 'wf_trg_user_variable_changed', 1, '0', 0, '', 0, 0, '');
```

> **Tip:** Use `sprite_id = 0` while you don't have a custom SWF sprite. The WIRED panel will still open and work normally.

After the inserts, note the auto-generated `id` values — you will need them in Step 2.

---

## Step 2 — Add a Catalogue Page & Items

Users need to be able to obtain the furni. The easiest way is to add it to an existing WIRED catalogue page (or create a new one).

### 2a — Find or create a catalogue page

```sql
-- Find the existing "WIRED Effects" page id
SELECT id, caption FROM catalog_pages WHERE caption LIKE '%wired%';
```

Or create a new page:

```sql
INSERT INTO `catalog_pages`
  (`parent_id`, `caption`, `icon_color`, `icon_image`,
   `visible`, `enabled`, `min_rank`, `order_num`,
   `page_layout`, `page_headline`, `page_teaser`,
   `page_special`, `page_text1`, `page_text2`,
   `page_text_details`, `page_text_teaser`, `vip_only`)
VALUES
  (1, 'User Variables', 1, 1,
   1, 1, 1, 99,
   'default_3x3', 'User Variables', '',
   '', '', '', '', '', 0);
```

### 2b — Add the furni to the page

Replace `<page_id>` with the page id from 2a, and `<base_item_id>` with the `id` returned by each INSERT in Step 1.

```sql
INSERT INTO `catalog_items`
  (`page_id`, `item_ids`, `catalog_name`, `cost_credits`,
   `cost_points`, `points_type`, `amount`,
   `limited_sells`, `limited_stack`, `offer_id`, `vip`,
   `extradata`, `have_offer`, `club_only`)
VALUES
  (<page_id>, '<base_item_id>', 'wf_act_define_user_variable',
   0, 0, 0, 1, 0, 0, -1, 0, '', '1', '0'),

  (<page_id>, '<base_item_id>', 'wf_act_give_user_variable',
   0, 0, 0, 1, 0, 0, -1, 0, '', '1', '0'),

  (<page_id>, '<base_item_id>', 'wf_act_change_user_variable',
   0, 0, 0, 1, 0, 0, -1, 0, '', '1', '0'),

  (<page_id>, '<base_item_id>', 'wf_trg_user_variable_changed',
   0, 0, 0, 1, 0, 0, -1, 0, '', '1', '0');
```

---

## Step 3 — Verify the Emulator Registration

Open `emulator/arcturus/src/main/java/com/eu/habbo/habbohotel/items/ItemManager.java` and confirm these four lines are present (they were added by this PR):

```java
this.interactionsList.add(new ItemInteraction("wf_trg_user_variable_changed", WiredTriggerUserVariableChanged.class));
// ...
this.interactionsList.add(new ItemInteraction("wf_act_give_user_variable",    WiredEffectGiveUserVariable.class));
this.interactionsList.add(new ItemInteraction("wf_act_change_user_variable",  WiredEffectChangeUserVariable.class));
this.interactionsList.add(new ItemInteraction("wf_act_define_user_variable",  WiredEffectDefineUserVariable.class));
```

If the lines are missing, add them following the same pattern as the surrounding entries.

---

## Step 4 — Verify the Frontend Layout Codes

The frontend maps integer codes sent by the server to the correct React view. Check:

**`nitro/nitro-react/src/api/wired/WiredActionLayoutCode.ts`**

```ts
public static GIVE_USER_VARIABLE:   number = 28;
public static CHANGE_USER_VARIABLE: number = 29;
public static DEFINE_USER_VARIABLE: number = 30;
```

**`nitro/nitro-react/src/api/wired/WiredTriggerLayoutCode.ts`**

```ts
public static USER_VARIABLE_CHANGED: number = 15;
```

**`nitro/nitro-react/src/components/wired/views/actions/WiredActionLayoutView.tsx`**

```tsx
case WiredActionLayoutCode.GIVE_USER_VARIABLE:   return <WiredActionGiveUserVariableView />;
case WiredActionLayoutCode.CHANGE_USER_VARIABLE: return <WiredActionChangeUserVariableView />;
case WiredActionLayoutCode.DEFINE_USER_VARIABLE: return <WiredActionDefineUserVariableView />;
```

**`nitro/nitro-react/src/components/wired/views/triggers/WiredTriggerLayoutView.tsx`**

```tsx
case WiredTriggerLayout.USER_VARIABLE_CHANGED: return <WiredTriggerUserVariableChangedView />;
```

These are all already in place. No frontend changes are needed.

---

## Step 5 — Reload / Restart

```bash
just restart-arcturus   # picks up the new items_base rows
just restart-nitro      # only needed if you changed TypeScript files
```

The emulator reloads `items_base` on startup, so a restart is sufficient — no recompile is needed for database-only changes.

---

## How to Create a Brand-New WIRED in the Future

Use the same checklist:

1. **Backend** — create a new Java class that extends `WiredEffect` (or `WiredTrigger`) and implement `execute()` / `handle()`. Register it in `ItemManager.java`.
2. **Enum** — add a new entry to `WiredEffectType` (or `WiredTriggerType`) with the next available integer code.
3. **Database** — insert a row in `items_base` with `interaction_type` matching the string you registered in `ItemManager.java`.
4. **Catalogue** — insert a row in `catalog_items` pointing at the new `items_base` row.
5. **Frontend layout code** — add the integer constant to `WiredActionLayoutCode.ts` or `WiredTriggerLayoutCode.ts`.
6. **Frontend view** — create a `WiredAction<Name>View.tsx` (or `WiredTrigger<Name>View.tsx`) component and register it in `WiredActionLayoutView.tsx` / `WiredTriggerLayoutView.tsx`.

---

## Quick Reference — User Variable Wireds

| Furni | `interaction_type` | Layout code | Java class |
|---|---|---|---|
| Define User Variable | `wf_act_define_user_variable` | Action **30** | `WiredEffectDefineUserVariable` |
| Give User Variable | `wf_act_give_user_variable` | Action **28** | `WiredEffectGiveUserVariable` |
| Change User Variable | `wf_act_change_user_variable` | Action **29** | `WiredEffectChangeUserVariable` |
| Variable Changed (trigger) | `wf_trg_user_variable_changed` | Trigger **15** | `WiredTriggerUserVariableChanged` |
