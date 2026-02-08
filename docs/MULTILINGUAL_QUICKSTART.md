# Guide Rapide - Système Multilingue

## ✅ Ce qui a été implémenté

Votre application supporte maintenant **3 langues**:
- 🇫🇷 **Français** (défaut)
- 🇩🇪 **Allemand**
- 🇬🇧 **Anglais**

## 🚀 Comment l'utiliser

### 1. Sélecteur de langue
Un sélecteur de langue a été ajouté dans la barre de navigation (coin supérieur droit).
Cliquez dessus pour changer de langue instantanément.

### 2. URLs multilingues
Les URLs incluent maintenant la langue:
- Français: `http://localhost:3002/fr/dashboard`
- Allemand: `http://localhost:3002/de/dashboard`
- Anglais: `http://localhost:3002/en/dashboard`

### 3. Exemple: Navigation traduite
Le menu de navigation est déjà traduit. Changez de langue pour voir:
- Dashboard, Planner, Shifts, Users, Settings, Logout

## 📝 Pour traduire vos pages

### Méthode simple en 2 étapes:

**1. Les traductions existent déjà!**
Tous les textes de votre application sont déjà traduits dans:
- `messages/fr.json` (Français)
- `messages/de.json` (Allemand)
- `messages/en.json` (Anglais)

**2. Utilisez-les dans vos composants:**

```tsx
'use client';
import { useTranslations } from 'next-intl';

export default function MaPage() {
  const t = useTranslations('dashboard'); // Namespace

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <button>{t('refresh')}</button>
    </div>
  );
}
```

## 📚 Namespaces disponibles

Tous les textes sont organisés par page:

- `common` - Boutons communs (save, cancel, delete, etc.)
- `nav` - Navigation
- `dashboard` - Page Dashboard
- `planner` - Page Planner
- `shifts` - Page Shifts
- `users` - Page Utilisateurs
- `settings` - Page Paramètres
- `login` - Page de connexion

## 🔗 Navigation avec i18n

**Important**: Utilisez les imports de `@/i18n/routing` au lieu de `next/navigation`:

```tsx
import { Link, useRouter, usePathname } from '@/i18n/routing';

// Au lieu de:
// import Link from 'next/link';
// import { useRouter, usePathname } from 'next/navigation';
```

## 🎯 État actuel

### ✅ Déjà traduit:
- Navigation (menu principal)
- Tous les textes sont disponibles dans les fichiers JSON

### 📋 À faire:
Pour traduire une page, remplacez simplement le texte en dur par `t('key')`.

**Exemple - Page Dashboard:**

Avant:
```tsx
<h1>Dashboard</h1>
<p>Vue d'ensemble de vos shifts et statistiques</p>
```

Après:
```tsx
const t = useTranslations('dashboard');

<h1>{t('title')}</h1>
<p>{t('subtitle')}</p>
```

## 📖 Documentation complète

Pour plus de détails, consultez [MULTILINGUAL_SETUP.md](./MULTILINGUAL_SETUP.md)

## 🧪 Tester

1. Démarrez le serveur: `npm run dev`
2. Accédez à: `http://localhost:3002`
3. Cliquez sur le sélecteur de langue (🇫🇷 / 🇩🇪 / 🇬🇧)
4. Observez le menu de navigation se traduire automatiquement

## 💡 Conseil

Pour traduire rapidement toutes vos pages, suivez ce processus:

1. Ouvrez une page (ex: `app/[locale]/dashboard/page.tsx`)
2. Ajoutez `const t = useTranslations('dashboard');`
3. Remplacez chaque texte par `{t('key')}`
4. Les traductions sont déjà dans les fichiers JSON!

Exemple complet dans `components/Navigation.tsx` ✅
