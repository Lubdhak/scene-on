    - [ ] DB at https://console.neon.tech/app/projects/snowy-fire-15936277?database=scene-on
    - [ ] # Frontend at https://vercel.com/lubdhaks-projects/scene-on-vercel
    - [ ] # Backend at https://dashboard.render.com/web/srv-d5jv8pvfte5s738umss0






Service	Local (Dev)	Production
Database	make db-create / db-drop (in database/)	Managed (Neon)
Backend	make dev (in backend/)	make build-prod then ./app (Render)
Frontend	make dev (in frontend/)	make build (Vercel)


cd Codebase/scene-on/backend
make dev

cd Codebase/scene-on/frontend
make dev

cd Codebase/scene-on/database
make db-create