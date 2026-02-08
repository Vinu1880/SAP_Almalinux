# Utilisation de Microsoft Graph API

Ce document explique comment utiliser Microsoft Graph API pour accéder aux calendriers des utilisateurs après l'authentification SSO.

## Configuration requise

### 1. Variables d'environnement (`.env`)

```env
NEXT_PUBLIC_AZURE_AD_CLIENT_ID="votre-client-id"
NEXT_PUBLIC_AZURE_AD_TENANT_ID="votre-tenant-id"
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI="http://localhost:3000"
```

### 2. Permissions Azure AD configurées

Les permissions suivantes ont été configurées dans Azure AD :
- `User.Read` - Lecture du profil utilisateur
- `Calendars.ReadBasic` - Lecture basique des calendriers
- `Calendars.Read` - Lecture complète des calendriers
- `Calendars.Read.Shared` - Lecture des calendriers partagés
- `Calendars.ReadWrite` - Lecture et écriture dans les calendriers

## Utilisation du hook `useGraphAPI`

### Exemple 1 : Récupérer les événements du calendrier

```tsx
'use client';

import { useGraphAPI } from '@/lib/hooks/useGraphAPI';
import { useEffect, useState } from 'react';

export default function CalendarPage() {
  const { getCalendarEvents, isLoading, error } = useGraphAPI();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const calendarEvents = await getCalendarEvents();
      if (calendarEvents) {
        setEvents(calendarEvents);
      }
    };

    fetchEvents();
  }, [getCalendarEvents]);

  if (isLoading) return <div>Chargement...</div>;
  if (error) return <div>Erreur: {error}</div>;

  return (
    <div>
      <h1>Mes événements</h1>
      {events.map((event) => (
        <div key={event.id}>
          <h3>{event.subject}</h3>
          <p>Début: {new Date(event.start.dateTime).toLocaleString()}</p>
          <p>Fin: {new Date(event.end.dateTime).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
```

### Exemple 2 : Récupérer les événements avec filtrage par date

```tsx
const startDate = '2025-01-01T00:00:00Z';
const endDate = '2025-12-31T23:59:59Z';

const events = await getCalendarEvents(startDate, endDate);
```

### Exemple 3 : Créer un événement dans le calendrier

```tsx
const { createCalendarEvent } = useGraphAPI();

const newEvent = {
  subject: 'Réunion d\'équipe',
  start: {
    dateTime: '2025-01-15T10:00:00',
    timeZone: 'Europe/Paris',
  },
  end: {
    dateTime: '2025-01-15T11:00:00',
    timeZone: 'Europe/Paris',
  },
  location: {
    displayName: 'Salle de réunion A',
  },
};

const createdEvent = await createCalendarEvent(newEvent);
```

### Exemple 4 : Récupérer le profil utilisateur

```tsx
const { getUserProfile } = useGraphAPI();

const profile = await getUserProfile();
if (profile) {
  console.log('Nom:', profile.displayName);
  console.log('Email:', profile.mail);
}
```

### Exemple 5 : Mettre à jour un événement

```tsx
const { updateCalendarEvent } = useGraphAPI();

const updatedEvent = await updateCalendarEvent('event-id', {
  subject: 'Réunion d\'équipe (Mise à jour)',
});
```

### Exemple 6 : Supprimer un événement

```tsx
const { deleteCalendarEvent } = useGraphAPI();

const success = await deleteCalendarEvent('event-id');
if (success) {
  console.log('Événement supprimé');
}
```

## Utilisation du contexte d'authentification

### Vérifier si l'utilisateur est authentifié

```tsx
import { useAuth } from '@/contexts/AuthContext';

export default function MyComponent() {
  const { isAuthenticated, account, isLoading } = useAuth();

  if (isLoading) return <div>Chargement...</div>;
  if (!isAuthenticated) return <div>Veuillez vous connecter</div>;

  return <div>Bienvenue {account?.name}</div>;
}
```

### Déconnexion

```tsx
const { logout } = useAuth();

const handleLogout = async () => {
  await logout();
};
```

### Obtenir un token d'accès manuellement

```tsx
const { getAccessToken } = useAuth();

const token = await getAccessToken();
// Utiliser le token pour des appels API personnalisés
```

## Appels personnalisés à Graph API

Si vous avez besoin de faire un appel qui n'est pas couvert par le hook :

```tsx
const { callGraphAPI } = useGraphAPI();

const customData = await callGraphAPI(
  'https://graph.microsoft.com/v1.0/me/mailFolders',
  {
    method: 'GET',
  }
);
```

## Gestion des erreurs

Le hook `useGraphAPI` gère automatiquement les erreurs. Vous pouvez les récupérer via la propriété `error` :

```tsx
const { getCalendarEvents, error } = useGraphAPI();

useEffect(() => {
  const fetchData = async () => {
    await getCalendarEvents();
  };
  fetchData();
}, []);

if (error) {
  console.error('Une erreur est survenue:', error);
}
```

## Notes importantes

1. **Authentification requise** : Toutes les méthodes du hook nécessitent que l'utilisateur soit authentifié via SSO.

2. **Gestion des tokens** : MSAL gère automatiquement le rafraîchissement des tokens. Si un token expire, il sera automatiquement renouvelé.

3. **Permissions** : Assurez-vous que les permissions nécessaires sont accordées dans Azure AD pour les opérations que vous souhaitez effectuer.

4. **Timezone** : Utilisez toujours des timezones explicites pour les événements de calendrier.

5. **Authentification email/password temporaire** : La connexion par email/password est marquée comme `@deprecated` et sera supprimée. Utilisez uniquement le SSO Microsoft pour la production.

## Ressources

- [Microsoft Graph API Documentation](https://learn.microsoft.com/en-us/graph/overview)
- [Calendar API Reference](https://learn.microsoft.com/en-us/graph/api/resources/calendar)
- [MSAL.js Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js)
