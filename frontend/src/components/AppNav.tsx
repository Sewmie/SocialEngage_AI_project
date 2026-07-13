import { Link, useLocation } from 'react-router-dom';
import { APP_NAME } from '../lib/branding';

export function AppNav() {
  const { pathname } = useLocation();

  return (
    <nav className="app-nav">
      <Link to="/" className="app-nav__brand">{APP_NAME}</Link>
      <div className="app-nav__links">
        <Link to="/" className={pathname === '/' ? 'app-nav__link app-nav__link--active' : 'app-nav__link'}>
          Create
        </Link>
        <Link
          to="/dashboard"
          className={pathname === '/dashboard' ? 'app-nav__link app-nav__link--active' : 'app-nav__link'}
        >
          Analytics
        </Link>
      </div>
    </nav>
  );
}
