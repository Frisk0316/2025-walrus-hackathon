'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

interface RoleAccessMessageProps {
  allowedRole: 'buyer' | 'seller' | 'auditor';
  currentRole: 'buyer' | 'seller' | 'auditor';
  featureName: string;
}

export function RoleAccessMessage({
  allowedRole,
  currentRole,
  featureName,
}: RoleAccessMessageProps) {
  const getRoleLabel = (role: string) => {
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  return (
    <Card>
      <CardContent className="pt-6 pb-6">
        <div className="text-center py-8">
          <AlertCircle className="h-16 w-16 mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-semibold mb-2">
            {getRoleLabel(allowedRole)} Access Required
          </h2>
          <p className="text-muted-foreground mb-4">
            {featureName} is only available for {getRoleLabel(allowedRole)} role.
          </p>
          <p className="text-sm text-muted-foreground">
            Current role:{' '}
            <Badge variant="outline" className="capitalize">
              {currentRole}
            </Badge>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
