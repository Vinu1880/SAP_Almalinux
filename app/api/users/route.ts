// app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET - Récupérer tous les utilisateurs
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const users = await prisma.user.findMany({
      include: {
        team: true,
        leadingTeam: true,
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' }
      ]
    });
    
    // Log détaillé pour debug et normaliser les champs JSON
    console.log('=== USERS FROM DATABASE ===');
    const normalizedUsers = users.map(user => {
      // S'assurer que rotationConfig est un objet, pas une chaîne
      let normalizedRotationConfig = user.rotationConfig;
      if (typeof user.rotationConfig === 'string') {
        try {
          normalizedRotationConfig = JSON.parse(user.rotationConfig);
          console.log(`⚠️ Parsing rotationConfig string for ${user.firstName}`);
        } catch (e) {
          console.error(`❌ Failed to parse rotationConfig for ${user.firstName}:`, e);
          normalizedRotationConfig = null;
        }
      }

      // S'assurer que availability est un objet, pas une chaîne
      let normalizedAvailability = user.availability;
      if (typeof user.availability === 'string') {
        try {
          normalizedAvailability = JSON.parse(user.availability);
        } catch (e) {
          console.error(`❌ Failed to parse availability for ${user.firstName}:`, e);
          normalizedAvailability = null;
        }
      }

      console.log(`${user.firstName} ${user.lastName}:`, {
        rotationConfig: normalizedRotationConfig,
        rotationConfigType: typeof normalizedRotationConfig,
        hasPatternId: !!(normalizedRotationConfig && (normalizedRotationConfig as any).patternId),
        rawJSON: JSON.stringify(normalizedRotationConfig)
      });

      return {
        ...user,
        rotationConfig: normalizedRotationConfig,
        availability: normalizedAvailability
      };
    });
    console.log('==============================');

    return NextResponse.json(normalizedUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST - Créer un nouvel utilisateur
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    console.log('=== CREATING USER ===');
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    // Préparer les données de base
    const userData: any = {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email.toLowerCase(),
      phone: body.phone || null,
      role: body.role || null,
      location: body.location || null,
      workPercent: body.workPercent || 100,
      status: body.status || 'ACTIVE',
      notes: body.notes || null
    };
    
    // Ajouter teamId seulement s'il existe
    if (body.teamId && body.teamId !== 'none') {
      userData.teamId = body.teamId;
    }
    
    // STOCKAGE DIRECT du rotationConfig comme JSON
    if (body.rotationConfig && body.rotationConfig.patternId) {
      userData.rotationConfig = {
        patternId: body.rotationConfig.patternId,
        priority: body.rotationConfig.priority || 'medium',
        allowedShiftTypes: body.rotationConfig.allowedShiftTypes || []
      };
      console.log('Storing rotationConfig as JSON:', userData.rotationConfig);
    } else {
      userData.rotationConfig = null;
      console.log('No rotation config to store');
    }
    
    // Ajouter availability si présent
    if (body.availability) {
      userData.availability = body.availability;
    }
    
    console.log('Final userData to create:', JSON.stringify(userData, null, 2));
    
    const user = await prisma.user.create({
      data: userData,
      include: {
        team: true,
        leadingTeam: true
      }
    });
    
    console.log('User created successfully:', {
      name: `${user.firstName} ${user.lastName}`,
      rotationConfig: user.rotationConfig,
      id: user.id
    });
    
    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'USER',
        entityId: user.id,
        data: user
      }
    });
    
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');

    // Détecter l'erreur d'email en double (Prisma unique constraint violation)
    if (error instanceof Error && error.message.includes('Unique constraint failed on the fields: (`email`)')) {
      return NextResponse.json(
        {
          error: 'Cet email est déjà utilisé par un autre utilisateur',
          code: 'EMAIL_EXISTS'
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Erreur lors de la création de l\'utilisateur',
        details: error instanceof Error ? error.message : 'Erreur inconnue',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : null) : undefined
      },
      { status: 500 }
    );
  }
}