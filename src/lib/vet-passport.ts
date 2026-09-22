import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import type { Pet, ActivityDef, LogEntry, VetEvent, User } from './types';

/**
 * Генерирует ветеринарный паспорт в формате PDF с QR-кодом
 */
export async function generateVetPassport(
  pet: Pet,
  activities: ActivityDef[],
  logs: LogEntry[],
  events: VetEvent[],
  users: User[]
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  // Заголовок
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Ветеринарный паспорт', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Информация о питомце
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(pet.name, margin, yPos);
  yPos += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const speciesNames: Record<string, string> = {
    cat: 'Кошка',
    dog: 'Собака',
    rabbit: 'Кролик',
    parrot: 'Попугай',
    hamster: 'Хомяк',
    fish: 'Рыбка'
  };

  doc.text(`Вид: ${speciesNames[pet.species] || pet.species}`, margin, yPos);
  yPos += 6;
  
  if (pet.breed) {
    doc.text(`Порода: ${pet.breed}`, margin, yPos);
    yPos += 6;
  }
  
  if (pet.birthday) {
    const birthDate = new Date(pet.birthday);
    const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    doc.text(`Дата рождения: ${birthDate.toLocaleDateString('ru-RU')} (${age} ${age === 1 ? 'год' : age < 5 ? 'года' : 'лет'})`, margin, yPos);
    yPos += 6;
  }

  // QR-код с данными питомца
  const qrData = JSON.stringify({
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    birthday: pet.birthday
  });
  
  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  const qrSize = 40;
  doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - margin - qrSize, yPos - 25, qrSize, qrSize);
  yPos += 15;

  // Разделитель
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Статистика активностей
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Статистика активностей', margin, yPos);
  yPos += 8;

  // Группируем логи по типам активностей
  const activityStats = activities.map(act => {
    const actLogs = logs.filter(log => log.actId === act.id);
    return {
      title: act.title,
      count: actLogs.length,
      lastDate: actLogs.length > 0 
        ? new Date(Math.max(...actLogs.map(l => l.at))).toLocaleDateString('ru-RU')
        : 'Нет данных'
    };
  }).filter(stat => stat.count > 0).sort((a, b) => b.count - a.count);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  activityStats.forEach(stat => {
    if (yPos > 270) {
      doc.addPage();
      yPos = margin;
    }
    doc.text(`${stat.title}: ${stat.count} ${stat.count === 1 ? 'раз' : stat.count < 5 ? 'раза' : 'раз'}`, margin, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Последний раз: ${stat.lastDate}`, margin + 5, yPos);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    yPos += 6;
  });

  yPos += 5;

  // Разделитель
  if (yPos > 260) {
    doc.addPage();
    yPos = margin;
  }
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Ветеринарные события
  if (events.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Ветеринарные события', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const sortedEvents = [...events].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sortedEvents.forEach(event => {
      if (yPos > 270) {
        doc.addPage();
        yPos = margin;
      }

      const eventDate = new Date(event.date);
      const dateStr = eventDate.toLocaleDateString('ru-RU');
      
      doc.setFont('helvetica', 'bold');
      doc.text(`${event.title}`, margin, yPos);
      yPos += 5;
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Дата: ${dateStr}`, margin, yPos);
      yPos += 5;
      
      if (event.note) {
        const noteLines = doc.splitTextToSize(event.note, pageWidth - margin * 2);
        doc.text(noteLines, margin, yPos);
        yPos += noteLines.length * 5;
      }
      
      yPos += 3;
    });
  }

  // Хозяева
  if (pet.ownerIds.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = margin;
    }

    yPos += 5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Хозяева', margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    pet.ownerIds.forEach(ownerId => {
      const owner = users.find(u => u.id === ownerId);
      if (owner) {
        if (yPos > 270) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(`• ${owner.name}`, margin, yPos);
        yPos += 6;
      }
    });
  }

  // Дата создания паспорта
  yPos += 10;
  if (yPos > 270) {
    doc.addPage();
    yPos = margin;
  }
  
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  const now = new Date();
  doc.text(`Паспорт создан: ${now.toLocaleDateString('ru-RU')} ${now.toLocaleTimeString('ru-RU')}`, margin, yPos);

  // Сохранение PDF
  const timestamp = now.getTime();
  const fileName = `vet-passport-${pet.name}-${timestamp}.pdf`;
  doc.save(fileName);
}
