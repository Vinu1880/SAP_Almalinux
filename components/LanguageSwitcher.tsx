'use client';

import { usePathname, useRouter } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';

const languages = {
  fr: { name: 'Français', flag: '🇫🇷' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  en: { name: 'English', flag: '🇬🇧' },
};

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale as 'fr' | 'de' | 'en' });
  };

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-auto border-0 bg-transparent hover:bg-secondary/20 focus:ring-0">
        <Globe className="w-4 h-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(languages).map(([code, { name, flag }]) => (
          <SelectItem key={code} value={code}>
            <div className="flex items-center gap-2">
              <span>{flag}</span>
              <span>{name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
