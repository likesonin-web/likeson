import React from 'react'
import { cn } from '@/lib/utils'

interface ContainerProps {
  children: React.ReactNode
  className?: string
}

const Container = ({ children, className }: ContainerProps) => {
  return (
    <div 
      className={cn(
        "max-w-screen-xl mx-auto px-2   ", 
        className
      )}
      
    >
      {children}
    </div>
  )
}

export default Container