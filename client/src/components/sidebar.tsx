import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import {
  Home,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  Phone,
  Upload,
  Target,
  MessageCircle,
  Volume2
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Contacts', href: '/contacts', icon: Users },
  { name: 'Campaigns', href: '/campaigns', icon: Phone },
  { name: 'Contact Campaigns', href: '/contact-campaigns', icon: Target },
  { name: 'WhatsApp Bulk', href: '/whatsapp-bulk', icon: MessageSquare },
  { name: 'WhatsApp Chats', href: '/whatsapp-chats', icon: MessageCircle },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'ElevenLabs Voice', href: '/elevenlabs-setup', icon: Volume2 },
  { name: 'Settings', href: '/enhanced-settings', icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-full w-64 flex-col bg-white dark:bg-gray-900 border-r">
      <div className="flex h-16 items-center px-6 border-b">
        <Phone className="h-8 w-8 text-blue-600" />
        <span className="ml-2 text-xl font-bold">AI Caller</span>
      </div>
      <nav className="flex-1 space-y-1 px-4 py-4">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                  )}
                />
                {item.name}
              </a>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}