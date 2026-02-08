# Gestion des membres d'équipe

## Vue d'ensemble

Ce système permet d'ajouter et de retirer des utilisateurs d'une équipe directement depuis la page **Users > Teams**, similaire au système d'ajout/suppression d'utilisateurs dans les shifts.

## Fonctionnalités implémentées

### 1. Interface utilisateur

**Composant `TeamMembersSelector`** (lignes 736-864 dans `app/users/page.tsx`) :
- Liste des membres actuels de l'équipe avec possibilité de les retirer
- Liste des utilisateurs disponibles (actifs et sans équipe) avec possibilité de les ajouter
- Affichage du rôle et du pourcentage de travail de chaque utilisateur
- Boutons visuels avec icônes `UserPlus` et `UserMinus`

### 2. Dialog de modification d'équipe

**Modifications dans le dialog** (lignes 2048-2140 dans `app/users/page.tsx`) :
- Ajout d'une section "Membres de l'équipe" avec le composant `TeamMembersSelector`
- Le chef d'équipe est maintenant sélectionnable uniquement parmi les membres de l'équipe
- Mise à jour automatique de la liste des chefs d'équipe possibles

### 3. Backend (API)

**Route PUT `/api/teams/[id]`** (lignes 81-123 dans `app/api/teams/[id]/route.ts`) :
- Gestion du paramètre `memberIds` (array de string)
- Calcul automatique des membres à ajouter et à retirer
- Mise à jour de la relation `teamId` dans la table `User`
- Les utilisateurs retirés ont leur `teamId` mis à `null`
- Les nouveaux membres ont leur `teamId` mis à jour avec l'ID de l'équipe

## Comment utiliser

### Modifier les membres d'une équipe

1. Accédez à **Users > Teams** (bouton "Équipes" dans la barre de navigation)
2. Cliquez sur **"Modifier"** sur la carte de l'équipe souhaitée
3. Dans le dialog qui s'ouvre, faites défiler jusqu'à la section **"Membres de l'équipe"**

#### Ajouter un membre

1. Regardez la liste **"Utilisateurs disponibles"** en bas
2. Cliquez sur le bouton vert avec l'icône **"+"** à côté de l'utilisateur à ajouter
3. L'utilisateur apparaît immédiatement dans la liste **"Membres de l'équipe"**

#### Retirer un membre

1. Regardez la liste **"Membres de l'équipe"** en haut
2. Cliquez sur le bouton rouge avec l'icône **"-"** à côté de l'utilisateur à retirer
3. L'utilisateur est déplacé dans la liste **"Utilisateurs disponibles"**

#### Sauvegarder les modifications

1. Cliquez sur **"Enregistrer"** en bas du dialog
2. Les changements sont appliqués dans la base de données
3. La page se rafraîchit automatiquement pour afficher les modifications

## Différences avec le système des Shifts

### Similitudes
- Interface utilisateur identique (deux listes avec boutons +/-)
- Mise à jour en temps réel de l'interface
- Sauvegarde dans la base de données

### Différences

| Shifts | Teams |
|--------|-------|
| Utilise `includedUserIds` et `excludedUserIds` | Utilise directement `memberIds` |
| Les utilisateurs peuvent être dans plusieurs shifts | Un utilisateur ne peut être que dans une seule équipe |
| Modifications stockées dans la table `Shift` | Modifications stockées dans la table `User` (champ `teamId`) |

## Structure de données

### Frontend (selectedTeam)

```typescript
{
  id: string;
  name: string;
  description: string;
  color: string;
  leadId: string | 'none';
  memberIds: string[]; // Nouveauté
}
```

### Backend (body.memberIds)

L'API attend un array d'IDs d'utilisateurs :

```json
{
  "name": "Équipe Support",
  "description": "...",
  "color": "#3b82f6",
  "leadId": "user-id-123",
  "memberIds": ["user-id-1", "user-id-2", "user-id-3"]
}
```

### Traitement backend

1. **Récupération des membres actuels** :
   ```typescript
   const currentMembers = await prisma.user.findMany({
     where: { teamId: id }
   });
   ```

2. **Calcul des différences** :
   - `membersToRemove` : membres actuels non dans `memberIds`
   - `membersToAdd` : membres dans `memberIds` mais pas actuels

3. **Application des changements** :
   ```typescript
   // Retirer
   await prisma.user.updateMany({
     where: { id: { in: membersToRemove } },
     data: { teamId: null }
   });

   // Ajouter
   await prisma.user.updateMany({
     where: { id: { in: membersToAdd } },
     data: { teamId: id }
   });
   ```

## Impact sur la base de données

### Table `User`

Quand un utilisateur est ajouté à une équipe :
```sql
UPDATE User SET teamId = 'team-id-123' WHERE id = 'user-id-456';
```

Quand un utilisateur est retiré d'une équipe :
```sql
UPDATE User SET teamId = NULL WHERE id = 'user-id-456';
```

### Table `Team`

Aucune modification directe. La relation est gérée via le champ `teamId` dans la table `User`.

### Table `AuditLog`

Chaque modification d'équipe crée un log d'audit :
```typescript
{
  action: 'UPDATE',
  entity: 'TEAM',
  entityId: 'team-id-123',
  data: {
    before: { /* état avant */ },
    after: { /* état après */ }
  }
}
```

## Validation et contraintes

### Chef d'équipe

- Le chef d'équipe **doit** être membre de l'équipe
- Si un utilisateur est retiré de l'équipe et qu'il était chef, le champ `leadId` reste inchangé (à corriger manuellement)

### Utilisateurs disponibles

- Seuls les utilisateurs avec `status = 'ACTIVE'` sont affichés dans "Utilisateurs disponibles"
- Les utilisateurs déjà dans l'équipe n'apparaissent pas dans cette liste

## Tests recommandés

1. ✅ **Ajouter un utilisateur à une équipe** :
   - Vérifier qu'il apparaît dans la liste des membres
   - Vérifier dans Prisma Studio que `user.teamId` est mis à jour

2. ✅ **Retirer un utilisateur d'une équipe** :
   - Vérifier qu'il disparaît de la liste des membres
   - Vérifier dans Prisma Studio que `user.teamId` est `null`

3. ✅ **Modifier plusieurs membres en une fois** :
   - Ajouter 2 utilisateurs et en retirer 1
   - Vérifier que tous les changements sont appliqués

4. ✅ **Sélectionner un chef d'équipe** :
   - Vérifier que seuls les membres de l'équipe apparaissent dans la liste
   - Vérifier que le chef est bien enregistré

5. ✅ **Rafraîchissement de l'interface** :
   - Après sauvegarde, vérifier que la carte de l'équipe affiche le bon nombre de membres
   - Vérifier que les badges (actifs, rotation) sont à jour

## Notes importantes

### Performance

- La route API utilise `updateMany` pour des performances optimales
- Deux appels `refetch` sont effectués après sauvegarde (teams + users) pour synchroniser l'interface

### Sécurité

- Aucune validation spécifique d'autorisation pour l'instant
- À ajouter : vérification que l'utilisateur connecté a le droit de modifier l'équipe

### Limitations actuelles

- Si un utilisateur est chef d'équipe et est retiré, le `leadId` n'est pas automatiquement mis à `null`
- Aucune notification n'est envoyée aux utilisateurs lors de changements d'équipe

## Améliorations futures possibles

1. **Validation du chef d'équipe** :
   - Automatiquement retirer le statut de chef si l'utilisateur est retiré de l'équipe

2. **Drag & Drop** :
   - Permettre de glisser-déposer les utilisateurs entre équipes

3. **Notifications** :
   - Notifier les utilisateurs quand ils sont ajoutés/retirés d'une équipe

4. **Historique** :
   - Afficher l'historique des changements d'équipe pour chaque utilisateur

5. **Recherche** :
   - Ajouter une barre de recherche dans la liste des utilisateurs disponibles

6. **Filtres** :
   - Filtrer par rôle, pourcentage de travail, localisation
