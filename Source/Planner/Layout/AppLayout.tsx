// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { NavLink, Outlet } from 'react-router-dom';

interface NavigationItem {
    label: string;
    icon: string;
    path: string;
}

const navigationItems: NavigationItem[] = [
    { label: 'Issues', icon: 'pi pi-list', path: '/' },
    { label: 'Alerts', icon: 'pi pi-bell', path: '/alerts' },
    { label: 'Pull requests', icon: 'pi pi-code', path: '/pull-requests' },
    { label: 'Work', icon: 'pi pi-play-circle', path: '/work' },
    { label: 'Usage', icon: 'pi pi-gauge', path: '/usage' },
    { label: 'Repositories', icon: 'pi pi-database', path: '/settings/repositories' },
    { label: 'GitHub', icon: 'pi pi-github', path: '/settings/github' },
    { label: 'Claude Accounts', icon: 'pi pi-user', path: '/settings/accounts' },
];

/**
 * Shared layout wrapping every page: a slim navigation sidebar and the routed content.
 */
export const AppLayout = () => {
    return (
        <div className='flex h-screen w-full overflow-hidden'>
            <nav className='flex w-56 shrink-0 flex-col border-r border-[var(--surface-border)] bg-[var(--surface-card)]'>
                <div className='flex items-center gap-2 px-4 py-4 text-lg font-semibold'>
                    <i className='pi pi-calendar' />
                    <span>Planner</span>
                </div>
                <ul className='m-0 flex list-none flex-col gap-1 p-2'>
                    {navigationItems.map((item) => (
                        <li key={item.path}>
                            <NavLink
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) =>
                                    `flex items-center gap-2 rounded px-3 py-2 no-underline transition-colors ` +
                                    (isActive
                                        ? 'bg-[var(--highlight-bg)] text-[var(--primary-color)]'
                                        : 'text-[var(--text-color)] hover:bg-[var(--surface-hover)]')
                                }>
                                <i className={item.icon} />
                                <span>{item.label}</span>
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </nav>
            <main className='flex min-w-0 flex-1 flex-col overflow-hidden'>
                <Outlet />
            </main>
        </div>
    );
};
