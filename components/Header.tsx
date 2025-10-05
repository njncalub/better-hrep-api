export const Header = () => {
  return (
    <header class="container">
      <nav>
        <ul>
          <li>
            <a href="/">
              <strong>Better HREP API</strong>
            </a>
          </li>
        </ul>
        <ul>
          <li><a href="/congresses">Congresses</a></li>
          <li><a href="/people">Representatives</a></li>
          <li><a href="/committees">Committees</a></li>
          <li><a href="/api">API Docs</a></li>
        </ul>
      </nav>
    </header>
  );
};
