# Last Mile

An endless, procedurally generated, non-interactive first-person shift as a London delivery rider on an electric moped. Pure static site — no build, no dependencies, all audio synthesised.

Run: `python -m http.server 8123` in this folder, open http://localhost:8123 and press **Start the shift** (sound needs that click). `M` mutes, `F` fullscreen.

Debug URL params: `t=18.5` start hour · `w=clear|cloudy|overcast|drizzle|rain|fog` · `d=soho|camden|…` start district · `dest=house|direct|flat|estate|tower` · `outcome=ready|short|long|gone|stolen` · `speed=8` run the sim faster · `dpr=1` force pixel ratio · `clock=6` sim seconds per real second.

Files: `js/core.js` (env, weather, data) · `world.js`/`world2.js` (streets, traffic, rider autopilot, corner swings) · `facade.js` (procedural building textures) · `vehicles.js` (painted vehicles + street lamps) · `people.js` (detailed figures and faces) · `render.js` (rotating-camera projection, street) · `scenes.js` (tunnels, shop, handlebars, phone) · `story.js` (the shift as a coroutine) · `audio.js` · `main.js`.
