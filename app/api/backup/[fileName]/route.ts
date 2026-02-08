// app/api/backup/[fileName]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { fileName } = await params;
    const backupsDir = path.join(process.cwd(), 'backups');
    const filePath = path.join(backupsDir, fileName);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Fichier non trouvé' },
        { status: 404 }
      );
    }
    
    fs.unlinkSync(filePath);
    
    return NextResponse.json({ 
      success: true,
      message: 'Sauvegarde supprimée' 
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}