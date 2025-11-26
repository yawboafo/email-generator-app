import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface PatternTemplateData {
  name: string;
  template: string;
  description: string;
  category: string;
  active?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { data, mode = 'add' } = await request.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid data format. Expected an array of pattern templates.' },
        { status: 400 }
      );
    }

    // Validate data structure
    const validData: PatternTemplateData[] = [];
    const errors: string[] = [];

    data.forEach((item, index) => {
      if (!item.name || !item.template || !item.description || !item.category) {
        errors.push(`Row ${index + 1}: Missing required fields (name, template, description, category)`);
        return;
      }

      validData.push({
        name: item.name.trim(),
        template: item.template.trim(),
        description: item.description.trim(),
        category: item.category.trim(),
        active: item.active !== undefined ? Boolean(item.active) : true
      });
    });

    if (validData.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid pattern templates found',
          errors 
        },
        { status: 400 }
      );
    }

    // Replace mode: delete existing records first
    if (mode === 'replace') {
      await prisma.pattern.deleteMany({});
    }

    // Insert pattern templates
    let imported = 0;
    let skipped = 0;

    for (const pattern of validData) {
      try {
        await prisma.pattern.upsert({
          where: { name: pattern.name },
          update: {
            template: pattern.template,
            description: pattern.description,
            category: pattern.category,
            active: pattern.active
          },
          create: {
            name: pattern.name,
            template: pattern.template,
            description: pattern.description,
            category: pattern.category,
            active: pattern.active
          }
        });
        imported++;
      } catch (error) {
        skipped++;
        errors.push(`Failed to import pattern "${pattern.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Pattern template import error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to import pattern templates'
      },
      { status: 500 }
    );
  }
}
