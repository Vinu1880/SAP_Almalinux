# Système Multilingue (i18n)

L'application supporte maintenant 3 langues : **Français (FR)**, **Allemand (DE)** et **Anglais (EN)**.

## Architecture

### Bibliothèque utilisée
- **next-intl** v4.4.0 - Solution recommandée pour Next.js 15 App Router

### Structure des fichiers

```
Autoplanner/
├── app/
│   ├── [locale]/              # Routes avec segment dynamique de langue
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── shifts/
│   │   ├── planner/
│   │   ├── settings/
│   │   ├── login/
│   │   ├── layout.tsx         # Layout avec NextIntlClientProvider
│   │   └── page.tsx
│   └── api/                   # API routes (pas de locale)
├── i18n/
│   ├── routing.ts             # Configuration des locales et navigation
│   └── request.ts             # Configuration des requêtes i18n
├── messages/
│   ├── fr.json                # Traductions françaises
│   ├── de.json                # Traductions allemandes
│   └── en.json                # Traductions anglaises
├── components/
│   └── LanguageSwitcher.tsx   # Sélecteur de langue
└── middleware.ts              # Middleware pour détection de langue
```

## URLs multilingues

Les URLs incluent automatiquement la langue:

- Français (défaut): `http://localhost:3000/fr/dashboard`
- Allemand: `http://localhost:3000/de/dashboard`
- Anglais: `http://localhost:3000/en/dashboard`

La racine `/` redirige automatiquement vers `/fr/` (langue par défaut).

## Utilisation dans les composants

### 1. Dans un composant Client ('use client')

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </div>
  );
}
```

### 2. Dans un composant Server (par défaut)

```tsx
import { useTranslations } from 'next-intl';

export default async function MyServerComponent() {
  const t = await useTranslations('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </div>
  );
}
```

### 3. Navigation avec i18n

Utilisez les wrappers de `@/i18n/routing` au lieu de `next/navigation`:

```tsx
import { Link, useRouter, usePathname } from '@/i18n/routing';

// Link component
<Link href="/dashboard">Dashboard</Link>

// Router
const router = useRouter();
router.push('/users');

// Pathname
const pathname = usePathname(); // Retourne le chemin sans la locale
```

## Fichiers de traduction

Les traductions sont organisées par namespace dans les fichiers JSON:

### Structure d'un fichier de traduction (ex: `messages/fr.json`)

```json
{
  "common": {
    "save": "Enregistrer",
    "cancel": "Annuler",
    "delete": "Supprimer"
  },
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "Vue d'ensemble de vos shifts"
  },
  "users": {
    "title": "Utilisateurs",
    "createUser": "Créer un utilisateur"
  }
}
```

### Namespaces disponibles

Les fichiers de traduction sont organisés en namespaces:

- `common` - Termes communs (boutons, actions, statuts)
- `nav` - Navigation (menu, liens)
- `dashboard` - Page Dashboard
- `planner` - Page Planner
- `shifts` - Page Shifts
- `users` - Page Utilisateurs
- `settings` - Page Paramètres
- `login` - Page de connexion

## Ajouter une nouvelle traduction

### Étape 1: Ajouter la clé dans tous les fichiers JSON

**messages/fr.json**
```json
{
  "dashboard": {
    "newFeature": "Nouvelle fonctionnalité"
  }
}
```

**messages/de.json**
```json
{
  "dashboard": {
    "newFeature": "Neue Funktion"
  }
}
```

**messages/en.json**
```json
{
  "dashboard": {
    "newFeature": "New feature"
  }
}
```

### Étape 2: Utiliser dans le composant

```tsx
const t = useTranslations('dashboard');

<button>{t('newFeature')}</button>
```

## Composant LanguageSwitcher

Le sélecteur de langue est déjà intégré dans la navigation:

```tsx
import LanguageSwitcher from '@/components/LanguageSwitcher';

<LanguageSwitcher />
```

Il affiche:
- 🇫🇷 Français
- 🇩🇪 Deutsch
- 🇬🇧 English

## Détection automatique de la langue

Le middleware (`middleware.ts`) gère automatiquement:

1. **Détection du navigateur** - Utilise l'en-tête `Accept-Language`
2. **Cookie de préférence** - Sauvegarde le choix de l'utilisateur
3. **URL explicite** - Respecte la locale dans l'URL
4. **Fallback** - Redirige vers le français si la locale n'est pas supportée

## TypeScript

Pour avoir l'autocomplétion des clés de traduction, vous pouvez créer un fichier de types:

```typescript
// types/i18n.ts
import fr from '@/messages/fr.json';

type Messages = typeof fr;

declare global {
  interface IntlMessages extends Messages {}
}
```

## Traduire une nouvelle page

### Exemple: Traduire la page Dashboard

1. **Les traductions existent déjà** dans `messages/{locale}.json` sous le namespace `dashboard`

2. **Mettre à jour le composant**:

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function DashboardPage() {
  const t = useTranslations('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <button>{t('refresh')}</button>
    </div>
  );
}
```

## Bonnes pratiques

1. **Organisez par namespace** - Groupez les traductions par page ou fonctionnalité
2. **Utilisez des clés descriptives** - `users.createButton` plutôt que `btn1`
3. **Évitez la duplication** - Utilisez le namespace `common` pour les termes réutilisés
4. **Testez toutes les langues** - Vérifiez que toutes les traductions sont cohérentes
5. **Gardez la même structure** - Les 3 fichiers JSON doivent avoir les mêmes clés

## Variables dans les traductions

Pour les traductions avec variables:

```json
{
  "users": {
    "greeting": "Bonjour {name}, vous avez {count} messages"
  }
}
```

```tsx
const t = useTranslations('users');

<p>{t('greeting', { name: 'Jean', count: 5 })}</p>
// Résultat: "Bonjour Jean, vous avez 5 messages"
```

## Pluralisation

Pour les pluriels:

```json
{
  "users": {
    "itemCount": "{count, plural, =0 {Aucun élément} =1 {Un élément} other {# éléments}}"
  }
}
```

```tsx
<p>{t('itemCount', { count: 0 })}</p> // "Aucun élément"
<p>{t('itemCount', { count: 1 })}</p> // "Un élément"
<p>{t('itemCount', { count: 5 })}</p> // "5 éléments"
```

## Dépannage

### Erreur: "Messages are not defined"

Assurez-vous que `NextIntlClientProvider` enveloppe votre application dans `layout.tsx`.

### La langue ne change pas

1. Vérifiez que vous utilisez `Link` et `useRouter` de `@/i18n/routing`
2. Effacez les cookies et le cache du navigateur
3. Vérifiez le middleware dans `middleware.ts`

### Traductions manquantes

Si une clé n'existe pas, next-intl affichera la clé elle-même. Vérifiez que:
1. La clé existe dans tous les fichiers de traduction
2. Le namespace est correct
3. L'orthographe est identique

## Ressources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Next.js Internationalization](https://nextjs.org/docs/app/building-your-application/routing/internationalization)
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
