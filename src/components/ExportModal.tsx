import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FileText, Code, File as FileIcon, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  chat: Chat;
  nickname: string;
  profilePic: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, chat, nickname, profilePic }) => {
  const [isExporting, setIsExporting] = useState(false);

  const exportAsTxt = () => {
    const header = `${nickname} - তোমার প্রিয় সঙ্গিনী\n${'='.repeat(30)}\n\n`;
    const footer = `\n\n${'='.repeat(30)}\n${nickname} ও রবিনের আলাপচারিতা\n${new Date().toLocaleString('bn-BD', { dateStyle: 'full', timeStyle: 'short' })}`;
    
    const content = header + chat.messages.map(m => {
      const role = m.role === 'user' ? 'তুমি' : nickname;
      const time = m.timestamp.toLocaleString('bn-BD');
      return `[${time}] ${role}: ${m.content}`;
    }).join('\n\n') + footer;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${chat.title}.txt`);
    onClose();
  };

  const exportAsHtml = () => {
    const messagesHtml = chat.messages.map(m => `
      <div class="message ${m.role}">
        <div class="header">
          <strong>${m.role === 'user' ? 'তুমি' : nickname}</strong>
          <span>${m.timestamp.toLocaleString('bn-BD')}</span>
        </div>
        <div class="content">${m.content.replace(/\n/g, '<br>')}</div>
      </div>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>${chat.title}</title>
        <style>
          body { font-family: 'Hind Siliguri', sans-serif; background: #fdf2f8; padding: 20px; color: #1f2937; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); }
          
          .export-header { display: flex; items-center: center; gap: 15px; margin-bottom: 40px; border-bottom: 2px solid #fce7f3; padding-bottom: 20px; }
          .profile-pic { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #be185d; }
          .header-info { display: flex; flex-direction: column; justify-content: center; }
          .name-row { display: flex; align-items: center; gap: 8px; }
          .nickname { font-size: 24px; font-weight: 800; color: #1f2937; }
          .sparkle { color: #be185d; font-size: 20px; }
          .subtitle { font-size: 14px; color: #be185d; font-weight: 500; margin-top: -4px; }

          .message { margin-bottom: 20px; padding: 18px; border-radius: 20px; position: relative; }
          .user { background: #be185d; color: white; margin-left: 60px; border-bottom-right-radius: 5px; }
          .model { background: #f9fafb; color: #1f2937; margin-right: 60px; border: 1px solid #f3f4f6; border-bottom-left-radius: 5px; }
          .header { font-size: 11px; margin-bottom: 8px; opacity: 0.7; display: flex; justify-content: space-between; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { line-height: 1.7; font-size: 15px; }

          .export-footer { margin-top: 50px; text-align: center; border-top: 2px solid #fce7f3; padding-top: 20px; color: #9ca3af; font-size: 12px; }
          .footer-brand { font-weight: 700; color: #be185d; margin-bottom: 4px; }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="container">
          <div class="export-header">
            <img src="${profilePic}" class="profile-pic">
            <div class="header-info">
              <div class="name-row">
                <span class="nickname">${nickname}</span>
                <span class="sparkle">✨</span>
              </div>
              <div class="subtitle">তোমার প্রিয় সঙ্গিনী</div>
            </div>
          </div>
          
          ${messagesHtml}

          <div class="export-footer">
            <div class="footer-brand">${nickname} ও রবিনের আলাপচারিতা</div>
            <div>${new Date().toLocaleString('bn-BD', { dateStyle: 'full', timeStyle: 'short' })}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${chat.title}.html`);
    onClose();
  };

  const exportAsPdf = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pdfWidth - (margin * 2);
      let currentY = margin;

      // Temporary container for rendering elements
      const renderContainer = document.createElement('div');
      renderContainer.style.position = 'fixed';
      renderContainer.style.left = '-9999px';
      renderContainer.style.top = '0';
      renderContainer.style.width = '800px'; // Fixed width for consistent rendering
      renderContainer.style.background = 'white';
      renderContainer.style.fontFamily = '"Hind Siliguri", "Inter", sans-serif';
      document.body.appendChild(renderContainer);

      const addElementToPdf = async (html: string) => {
        renderContainer.innerHTML = html;
        
        // Wait for images in this element
        const images = renderContainer.getElementsByTagName('img');
        await Promise.all(Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        }));
        
        await document.fonts.ready;

        const canvas = await html2canvas(renderContainer, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 800,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Check if we need a new page
        if (currentY + imgHeight > pdfHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }

        pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 5; // Add a small gap between elements
      };

      // 1. Add Header
      await addElementToPdf(`
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 20px; border-bottom: 2px solid #fce7f3; padding-bottom: 20px; width: 100%;">
          <img src="${profilePic}" style="width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid #be185d;" crossorigin="anonymous">
          <div style="display: flex; flex-direction: column; justify-content: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 24px; font-weight: 800; color: #1f2937;">${nickname}</span>
              <span style="color: #be185d; font-size: 20px;">✨</span>
            </div>
            <div style="font-size: 14px; color: #be185d; font-weight: 500; margin-top: -4px;">তোমার প্রিয় সঙ্গিনী</div>
          </div>
        </div>
      `);

      // 2. Add Messages one by one
      for (const m of chat.messages) {
        await addElementToPdf(`
          <div style="margin-bottom: 20px; padding: 25px; border-radius: 25px; background: ${m.role === 'user' ? '#be185d' : '#f9fafb'}; color: ${m.role === 'user' ? 'white' : '#1f2937'}; border: ${m.role === 'model' ? '1px solid #f3f4f6' : 'none'}; border-bottom-${m.role === 'user' ? 'right' : 'left'}-radius: 8px; margin-${m.role === 'user' ? 'left' : 'right'}: 80px; width: calc(100% - 80px); box-sizing: border-box; overflow-wrap: break-word; word-wrap: break-word; word-break: break-word;">
            <div style="font-size: 12px; margin-bottom: 12px; opacity: 0.8; display: flex; justify-content: space-between; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid ${m.role === 'user' ? 'rgba(255,255,255,0.2)' : '#f1f5f9'}; padding-bottom: 5px;">
              <strong>${m.role === 'user' ? 'তুমি' : nickname}</strong>
              <span>${m.timestamp.toLocaleString('bn-BD')}</span>
            </div>
            <div style="line-height: 1.8; font-size: 16px; white-space: pre-wrap;">${m.content}</div>
          </div>
        `);
      }

      // 3. Add Footer
      await addElementToPdf(`
        <div style="margin-top: 30px; text-align: center; border-top: 2px solid #fce7f3; padding-top: 20px; color: #9ca3af; font-size: 12px; width: 100%;">
          <div style="font-weight: 700; color: #be185d; margin-bottom: 4px;">${nickname} ও রবিনের আলাপচারিতা</div>
          <div>${new Date().toLocaleString('bn-BD', { dateStyle: 'full', timeStyle: 'short' })}</div>
        </div>
      `);

      pdf.save(`${chat.title}.pdf`);
      document.body.removeChild(renderContainer);
    } catch (error) {
      console.error('PDF Export failed:', error);
      alert('পিডিএফ এক্সপোর্ট করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setIsExporting(false);
      onClose();
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="export-modal-container" className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            key="export-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="export-modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-sm bg-card-bg rounded-3xl shadow-2xl overflow-hidden border border-border-custom"
          >
            <div className="p-5 border-b border-border-custom flex items-center justify-between bg-romantic-deep text-white">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Download className="w-5 h-5" /> এক্সপোর্ট করুন
              </h3>
              <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-text-muted mb-4 text-center">
                আপনি কোন ফরম্যাটে আলাপটি সেভ করতে চান?
              </p>

              <button
                onClick={exportAsTxt}
                disabled={isExporting}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border-custom hover:border-romantic-deep/30 hover:bg-romantic-pink/10 transition-all group"
              >
                <div className="p-3 rounded-xl bg-blue-50 text-blue-500 group-hover:bg-blue-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-text-main text-sm">Text (.txt)</p>
                  <p className="text-[10px] text-text-muted">সাধারণ টেক্সট ফাইল</p>
                </div>
              </button>

              <button
                onClick={exportAsHtml}
                disabled={isExporting}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border-custom hover:border-romantic-deep/30 hover:bg-romantic-pink/10 transition-all group"
              >
                <div className="p-3 rounded-xl bg-orange-50 text-orange-500 group-hover:bg-orange-100">
                  <Code className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-text-main text-sm">HTML (.html)</p>
                  <p className="text-[10px] text-text-muted">ব্রাউজারে দেখার জন্য উপযুক্ত</p>
                </div>
              </button>

              <button
                onClick={exportAsPdf}
                disabled={isExporting}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border-custom hover:border-romantic-deep/30 hover:bg-romantic-pink/10 transition-all group"
              >
                <div className="p-3 rounded-xl bg-red-50 text-red-500 group-hover:bg-red-100">
                  {isExporting ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileIcon className="w-6 h-6" />}
                </div>
                <div className="text-left">
                  <p className="font-bold text-text-main text-sm">PDF (.pdf)</p>
                  <p className="text-[10px] text-text-muted">প্রিন্ট বা শেয়ার করার জন্য সেরা</p>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
