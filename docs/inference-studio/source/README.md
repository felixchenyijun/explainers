# Guided inference lessons

This is the editable source for the adjacent self-contained `index.html`.

```sh
npm ci
npm run build
```

- `chapters.js` supplies the six-step explanations, predictions, worked examples, and primary sources for each lesson.
- `scenes.js` renders deterministic Three.js scenes for `(lesson, step, progress, parameter)` and computes the numerical experiment readouts.
- `app.js` coordinates deliberate stepping, replay, optional whole-lesson pacing, local read-aloud, and accessible navigation.
- `template.txt` contains the page structure and styles. It is a build input, not a browser entry point.
- `reference-lessons.js` retains the original references and background caveats used by the expanded course.

The build embeds Three.js, application code, CSS, and the complete MIT notice. The independent `watch.html` player and silent downloadable MP4s remain short earlier recaps, and are labeled accordingly.
