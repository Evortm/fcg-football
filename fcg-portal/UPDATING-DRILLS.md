# Updating Drills — Quick Guide

This guide explains how to add and update drill content for the FCG coach portal.

## Where Everything Goes

| Content | File | Folder |
|---------|------|--------|
| Drill text (title, description, success criteria) | `data/drills.js` | `fcg-portal/data/` |
| Drill diagram images | Named `{TOPIC}_{NUMBER}.png` (sequential) | `fcg-portal/img/drills/` |
| Gameplan pitch images | Named `{TOPIC}-{STYLE}.png` | `fcg-portal/img/` |
| Video links | `video` field in drill entry | Inside `data/drills.js` |

## Drill Image Numbering (Sequential — No Renaming!)

Images use **sequential numbering** per topic. The code auto-computes which image belongs to which age group and phase.

**Formula:** `image_number = ageIndex × 4 + phaseIndex`

| Age | ageIndex | Image numbers | 
|-----|----------|---------------|
| U4  | 0 | 0, 1, 2, 3 |
| U5  | 1 | 4, 5, 6, 7 |
| U6  | 2 | 8, 9, 10, 11 |
| U7  | 3 | 12, 13, 14, 15 |
| U8  | 4 | 16, 17, 18, 19 |
| U9  | 5 | 20, 21, 22, 23 |
| U10 | 6 | 24, 25, 26, 27 |
| U11 | 7 | 28, 29, 30, 31 |
| U12 | 8 | 32, 33, 34, 35 |

Within each age group: `0=activation, 1=drill1, 2=drill2, 3=drill3`

**Example for topic A2:**
```
A2_0.png  = U4 activation     A2_4.png  = U5 activation
A2_1.png  = U4 drill 1        A2_5.png  = U5 drill 1
A2_2.png  = U4 drill 2        A2_6.png  = U5 drill 2
A2_3.png  = U4 drill 3        A2_7.png  = U5 drill 3
...
```

Just export your images in order and name them `{TOPIC}_0.png`, `{TOPIC}_1.png`, etc. No renaming needed!

## Gameplan Styles by Age

| Age Groups | Style | Image suffix |
|------------|-------|-------------|
| U4, U5 | 3v3 | `-3v3.png` |
| U6, U7 | 5v5 | `-5v5.png` |
| U8, U9 | 7v7 | `-7v7.png` |
| U10 | 8v8-1 | `-8v8-1.png` |
| U11, U12 | 8v8-2 | `-8v8-2.png` |

## Topics

| Code | Name | Code | Name |
|------|------|------|------|
| A1 | Start from GK | D1 | Press the GK ball |
| A2 | Build up | D2 | Push them outside |
| A3 | Through the middle | D3 | Shifting |
| A4 | Scoring goals | D4 | Long balls |
| A5 | Keep the ball | D5 | Defend our wings |
| A6 | Switch sides | D6 | Defend our goal |
| A7 | Wing attack | | |
| A8 | Cross and finish | | |

---

## How To: Add Drills for a New Topic (e.g. A2 at U6)

### Step 1: Create drill diagram images

Create 4 diagram images (activation + 3 drills). For U6 (ageIndex=2), the numbers are 8-11:

```
A2_8.png   (U6 activation)
A2_9.png   (U6 drill 1)
A2_10.png  (U6 drill 2)
A2_11.png  (U6 drill 3)
```

Upload them to: `fcg-portal/img/drills/`

**No need to set image paths in drills.js — the code computes them automatically!**

### Step 2: Add gameplan image (optional)

Create a pitch diagram named: `A2-5v5.png` (U6 = 5v5 style)

Upload to: `fcg-portal/img/`

If you skip this, the gameplan section shows text only (image auto-hides).

### Step 3: Add drill descriptions

Open: `fcg-portal/data/drills.js`

Find an existing block (like `"A1 | U6"`), copy it, and change the key:

```javascript
  "A2 | U6": {
    age: "U6",
    topic: "A2",
    coach: "Mia,Relax",
    activation: {
      title: "Passing Gates",
      desc: "Players pass through gates, focusing on:\nBig step, inside foot, balance.",
      success: "All players can pass with correct technique"
    },
    drill1: {
      title: "Build up from GK",
      desc: "GK plays to defender who builds up under pressure.",
      success: "7 out of 10 successful build-ups",
      video: "https://www.capcut.cn/share/YOUR_VIDEO_ID"
    },
    drill2: {
      title: "3v2 build up",
      desc: "3 attackers vs 2 defenders, build from GK.",
      success: "5 out of 10 clean exits"
    },
    drill3: {
      title: "4v4 SSG",
      desc: "Small-sided game focusing on build-up.",
      success: "Team builds from GK every time"
    }
  },
```

Note: **No `image` field needed** — it's auto-computed from the sequential numbering.

### Step 4: Save and deploy

- Save the file
- Commit and push to GitHub (or upload via GitHub web interface)
- GitHub Pages auto-deploys within 1-2 minutes

---

## How To: Add a Video Link

1. Open `data/drills.js`
2. Find the drill you want to add a video to
3. Add a `video` field with the full URL:

```javascript
    drill1: {
      title: "Build up from GK",
      desc: "...",
      success: "...",
      video: "https://www.capcut.cn/share/7647067494599120190"
    },
```

Supported platforms:
- **CapCut**: `https://www.capcut.cn/share/XXXXX`
- **Bilibili**: `https://www.bilibili.com/video/BVXXXXX` or `https://b23.tv/XXXXX`

The video field is **optional** — if you don't have a video, just leave it out.

---

## How To: Edit Existing Drill Text

1. Open `data/drills.js`
2. Find the entry by its key (e.g. `"A1 | U4"`)
3. Edit the `title`, `desc`, or `success` text
4. Use `\n` for line breaks in descriptions
5. Save and push

---

## How To: Upload Images via GitHub Web

1. Go to: https://github.com/Evortm/fcg-football
2. Navigate to `fcg-portal/img/drills/` (for drill images) or `fcg-portal/img/` (for gameplan images)
3. Click "Add file" → "Upload files"
4. Drag your images in (make sure they're named correctly!)
5. Click "Commit changes"
6. Wait 1-2 minutes for GitHub Pages to rebuild

---

## File Structure Overview

```
fcg-portal/
  index.html              ← Do NOT edit (presentation only)
  data/
    drills.js             ← EDIT THIS: drill descriptions + videos (no image paths needed)
    gameplans.js          ← Tactical text (rarely needs editing)
    drills-template.js    ← Reference template (do not edit)
  img/
    A1-3v3.png            ← Gameplan images (TOPIC-STYLE.png)
    A1-5v5.png
    ...
    drills/
      A1_0.png            ← Drill images (TOPIC_NUMBER.png, sequential)
      A1_1.png
      ...
    easy.jpg              ← Coach photos
    mia.jpg
    ...
  UPDATING-DRILLS.md      ← This file
```
