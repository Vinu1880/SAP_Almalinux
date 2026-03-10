'use client';

import React, { useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import Image from 'next/image';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import {
  Calendar,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const Navigation = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const t = useTranslations('nav');
  const { account, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const navigationItems = [
    {
      key: '/dashboard',
      label: t('dashboard'),
      icon: BarChart3,
      description: t('dashboard')
    },
    {
      key: '/users',
      label: t('users'),
      icon: Users,
      description: t('users')
    },
    {
      key: '/shifts',
      label: t('shifts'),
      icon: Clock,
      description: t('shifts')
    },
    {
      key: '/planner',
      label: t('planner'),
      icon: Calendar,
      description: t('planner')
    },
    {
      key: '/settings',
      label: t('settings'),
      icon: Settings,
      description: t('settings')
    }
  ];

  const NavigationLink = ({ item, mobile = false }: { item: any; mobile?: boolean }) => {
    const Icon = item.icon;
    const isActive = pathname === item.key;
    
    return (
      <Link
        href={item.key}
        className={`
          flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200
          ${mobile ? 'w-full' : ''}
          ${isActive
            ? 'bg-primary/10 text-primary border border-primary/20'
            : 'text-slate-600 hover:text-slate-900 hover:bg-secondary/20'
          }
        `}
        onClick={() => mobile && setIsMobileMenuOpen(false)}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
        <div className="flex flex-col">
          <span className={`font-medium ${isActive ? 'text-primary' : ''}`}>
            {item.label}
          </span>
          {mobile && (
            <span className="text-xs text-slate-500 mt-0.5">
              {item.description}
            </span>
          )}
        </div>
      </Link>
    );
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:block bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center space-x-8">
              <Link href="/dashboard">
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={120}
                  height={40}
                  className="object-contain"
                  priority
                />
              </Link>

              {/* Navigation Links */}
              <div className="flex items-center space-x-2">
                {navigationItems.map((item) => (
                  <NavigationLink key={item.key} item={item} />
                ))}
              </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-4">
              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-auto py-2 px-3 rounded-xl hover:bg-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center ring-2 ring-blue-100 shadow-md">
                        <span className="text-white font-semibold text-sm">
                          {account?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                        </span>
                      </div>
                      <div className="text-left hidden md:block">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">
                          {account?.name || t('user')}
                        </p>
                        <p className="text-xs text-slate-500 leading-tight">
                          {account?.username?.split('@')[0] || t('notConnected')}
                        </p>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72" align="end" forceMount>
                  <div className="px-4 py-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-t-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center ring-2 ring-white shadow-lg">
                        <span className="text-white font-bold text-base">
                          {account?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {account?.name || t('user')}
                        </p>
                        <p className="text-xs text-slate-600 truncate">
                          {account?.username || t('notConnected')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-100 font-medium"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-3 h-5 w-5" />
                      <span>{t('logout')}</span>
                    </Button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Image
                src="/logo.png"
                alt="Logo"
                width={90}
                height={30}
                className="object-contain"
                priority
              />
            </Link>

            <div className="flex items-center space-x-2">
              {/* Language Switcher */}
              <LanguageSwitcher />

              {/* Mobile Menu */}
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-4 border-b">
                      <div className="flex items-center space-x-2">
                        <Image
                          src="/logo.png"
                          alt="Logo"
                          width={90}
                          height={30}
                          className="object-contain"
                        />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>

                    {/* Navigation Links */}
                    <div className="flex-1 py-6 space-y-2">
                      {navigationItems.map((item) => (
                        <NavigationLink key={item.key} item={item} mobile />
                      ))}
                    </div>

                    {/* User Info */}
                    <div className="border-t pt-4">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 mx-4 mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center ring-2 ring-white shadow-lg">
                            <span className="text-white font-bold text-sm">
                              {account?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {account?.name || t('user')}
                            </p>
                            <p className="text-xs text-slate-600 truncate">
                              {account?.username || t('notConnected')}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="px-4">
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-100 font-medium py-3"
                          onClick={handleLogout}
                        >
                          <LogOut className="w-5 h-5 mr-3" />
                          <span>{t('logout')}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navigation;