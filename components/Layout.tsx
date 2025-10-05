export const Layout = (props: { title?: string; children?: unknown }) => {
  const { title = "Better HREP", children } = props;
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          body {
            padding: 1rem;
          }
          nav {
            margin-bottom: 2rem;
          }
          nav ul {
            list-style: none;
            padding: 0;
            display: flex;
            gap: 1rem;
          }
          .card {
            margin-bottom: 1rem;
            padding: 1rem;
            border: 1px solid var(--pico-muted-border-color);
            border-radius: var(--pico-border-radius);
          }
          .card h3 {
            margin-top: 0;
          }
          .meta {
            color: var(--pico-muted-color);
            font-size: 0.875rem;
          }
          .list-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 1rem;
          }
        `}</style>
      </head>
      <body>
        <header>
          <nav>
            <ul>
              <li><a href="/"><strong>Better HREP</strong></a></li>
              <li><a href="/congresses">Congresses</a></li>
              <li><a href="/people">Representatives</a></li>
              <li><a href="/committees">Committees</a></li>
              <li><a href="/api">API Docs</a></li>
            </ul>
          </nav>
        </header>
        <main>
          {children}
        </main>
        <footer>
          <p class="meta">
            Data from <a href="https://congress.gov.ph" target="_blank">House of Representatives</a>
          </p>
        </footer>
      </body>
    </html>
  );
};
