import { Header } from "./Header.tsx";
import { Footer } from "./Footer.tsx";

interface LayoutProps {
  title?: string;
  children?: unknown;
}

export const Layout = (props: LayoutProps) => {
  const { title = "Better HREP API", children } = props;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta
          name="description"
          content="A clean, well-documented interface for browsing Philippine House of Representatives legislative data"
        />
        <title>{title}</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
        />
        <link rel="stylesheet" href="/static/styles.css" />
      </head>
      <body>
        <Header />
        <main class="container">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
};
