# Updating Drills — Quick Guide

This guide explains how to add and update drill content for the FCG coach portal.

## Where Everything Goes

| Content | File | Folder |
|---------|------|--------|
| Drill text (title, description, success criteria) | `data/drills.js` | `fcg-portal/data/` |
| Drill diagram images | Named `{TOPIC}_{AGE}_{PHASE}.png` | `fcg-portal/img/drills/` |
| Gameplan pitch images | Named `{TOPIC}-{STYLE}.png` | `fcg-portal/img/` |
| Video links | `video` field in drill entry | Inside `data/drills.js` |

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

Create 4 diagram images (activation + 3 drills). Name them:

```
A2_U6_0.png   (activation)
A2_U6_1.png   (drill 1)
A2_U6_2.png   (drill 2)
A2_U6_3.png   (drill 3)
```

Upload them to: `fcg-portal/img/drills/`

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
      image: "img/drills/A2_U6_0.png",
      success: "All players can pass with correct technique"
    },
    drill1: {
      title: "Build up from GK",
      desc: "GK plays to defender who builds up under pressure.",
      image: "img/drills/A2_U6_1.png",
      success: "7 out of 10 successful build-ups",
      video: "https://www.capcut.cn/share/YOUR_VIDEO_ID"
    },
    drill2: {
      title: "3v2 build up",
      desc: "3 attackers vs 2 defenders, build from GK.",
      image: "img/drills/A2_U6_2.png",
      success: "5 out of 10 clean exits"
    },
    drill3: {
      title: "4v4 SSG",
      desc: "Small-sided game focusing on build-up.",
      image: "img/drills/A2_U6_3.png",
      success: "Team builds from GK every time"
    }
  },
```

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
      image: "img/drills/A2_U6_1.png",
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
    drills.js             ← EDIT THIS: drill descriptions, images, videos
    gameplans.js          ← Tactical text (rarely needs editing)
    drills-template.js    ← Reference template (do not edit)
  img/
    A1-3v3.png            ← Gameplan images (TOPIC-STYLE.png)
    A1-5v5.png
    ...
    drills/
      A1_U4_0.png         ← Drill images (TOPIC_AGE_PHASE.png)
      A1_U4_1.png
      ...
    easy.jpg              ← Coach photos
    mia.jpg
    ...
  UPDATING-DRILLS.md      ← This file
```
