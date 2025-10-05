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
        <meta name="description" content="A clean, well-documented interface for browsing Philippine House of Representatives legislative data" />
        <title>{title}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          /* Container and spacing */
          body {
            padding: 0;
          }

          main {
            padding: 2rem 1rem;
          }

          header nav {
            margin-bottom: 0;
          }

          /* Card components */
          .card {
            margin-bottom: 1.5rem;
            padding: 1.5rem;
            border: 1px solid var(--pico-muted-border-color);
            border-radius: var(--pico-border-radius);
            transition: box-shadow 0.2s ease-in-out;
          }

          .card:hover {
            box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.1);
          }

          .card h3 {
            margin-top: 0;
            margin-bottom: 0.5rem;
          }

          .card h3 a {
            text-decoration: none;
          }

          .card h3 a:hover {
            text-decoration: underline;
          }

          /* List grid layout */
          .list-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          }

          /* Metadata text */
          .meta {
            color: var(--pico-muted-color);
            font-size: 0.875rem;
            margin: 0.5rem 0;
          }

          /* Pagination navigation */
          nav[role="navigation"] {
            margin-top: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          nav[role="navigation"] ul {
            display: flex;
            gap: 1rem;
            list-style: none;
            padding: 0;
            margin: 0;
          }

          /* Back navigation */
          .back-link {
            display: inline-block;
            margin-bottom: 1rem;
            text-decoration: none;
          }

          .back-link:hover {
            text-decoration: underline;
          }

          /* Navigation with back links */
          nav:has(a[href*="Back"]) {
            margin-bottom: 1.5rem;
          }

          /* Hero section */
          .hero {
            text-align: center;
            margin-bottom: 3rem;
          }

          .hero h1 {
            margin-bottom: 0.5rem;
          }

          .hero p {
            color: var(--pico-muted-color);
          }

          /* Footer */
          footer {
            margin-top: 3rem;
            text-align: center;
          }

          /* People grid and cards */
          .people-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          }

          .person-card {
            margin-bottom: 0;
            padding: 0;
            border: 1px solid var(--pico-muted-border-color);
            border-radius: var(--pico-border-radius);
            transition: all 0.2s ease-in-out;
            background: var(--pico-card-background-color);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            height: 100%;
          }

          .person-card:hover {
            box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
            transform: translateY(-2px);
          }

          .person-card-header {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1.5rem;
            background: var(--pico-card-sectioning-background-color);
            border-bottom: 1px solid var(--pico-muted-border-color);
            flex-shrink: 0;
          }

          .person-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: var(--pico-primary-background);
            color: var(--pico-primary-inverse);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            font-weight: 700;
            flex-shrink: 0;
          }

          .person-info {
            flex: 1;
            min-width: 0;
          }

          .person-info h3 {
            margin: 0 0 0.25rem 0;
            font-size: 1.1rem;
          }

          .person-info h3 a {
            text-decoration: none;
            color: var(--pico-primary);
          }

          .person-info h3 a:hover {
            text-decoration: underline;
          }

          .nickname {
            margin: 0;
            font-size: 0.875rem;
            color: var(--pico-muted-color);
            font-style: italic;
          }

          .person-card-body {
            padding: 1rem;
            flex: 1;
            display: flex;
            flex-direction: column;
          }

          .person-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
            margin-top: 1rem;
          }

          .stat {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            padding: 0.75rem 0.5rem;
            background: var(--pico-card-sectioning-background-color);
            border-radius: calc(var(--pico-border-radius) * 0.5);
            min-width: 0;
          }

          .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: var(--pico-primary);
            line-height: 1.2;
            margin-bottom: 0.25rem;
          }

          .stat-label {
            font-size: 0.7rem;
            color: var(--pico-muted-color);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            line-height: 1.2;
            word-wrap: break-word;
            overflow-wrap: break-word;
            hyphens: auto;
          }

          .person-congress-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .congress-badge {
            display: inline-block;
            padding: 0.25rem 0.625rem;
            background: var(--pico-secondary-background);
            color: var(--pico-secondary-inverse);
            border-radius: calc(var(--pico-border-radius) * 0.5);
            font-size: 0.8125rem;
            font-weight: 600;
          }

          /* Bills list */
          .bills-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 2rem;
          }

          .bill-card {
            padding: 1.5rem;
            border: 1px solid var(--pico-muted-border-color);
            border-radius: var(--pico-border-radius);
            background: var(--pico-card-background-color);
            transition: box-shadow 0.2s ease-in-out;
          }

          .bill-card:hover {
            box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.1);
          }

          .bill-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 1rem;
            margin-bottom: 0.75rem;
          }

          .bill-header h3 {
            margin: 0;
            font-size: 1.25rem;
          }

          .bill-header h3 a {
            text-decoration: none;
            color: var(--pico-primary);
          }

          .bill-header h3 a:hover {
            text-decoration: underline;
          }

          .bill-date {
            font-size: 0.875rem;
            color: var(--pico-muted-color);
            white-space: nowrap;
          }

          .bill-title {
            font-size: 1rem;
            line-height: 1.5;
            margin-bottom: 0.75rem;
          }

          .bill-meta {
            display: flex;
            gap: 1.5rem;
            margin-bottom: 0.75rem;
          }

          .bill-meta-item {
            font-size: 0.875rem;
            color: var(--pico-muted-color);
          }

          .bill-meta-item strong {
            color: var(--pico-color);
          }

          .bill-status {
            font-size: 0.875rem;
            color: var(--pico-muted-color);
            margin: 0;
            font-style: italic;
          }
        `}</style>
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
