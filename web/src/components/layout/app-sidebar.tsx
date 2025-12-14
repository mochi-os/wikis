import { useMemo } from 'react'
import { Library } from 'lucide-react'
import { useLayout } from '@mochi/common'
import { usePermissions, useWikiContext } from '@/context/wiki-context'
import {
  Sidebar,
  SidebarContent,
  SidebarRail,
} from '@mochi/common'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from '@mochi/common'
import { getAppPath } from '@mochi/common'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const permissions = usePermissions()
  const { info } = useWikiContext()

  // Get wiki name if in entity context
  const wikiName = info?.entity && info?.wiki?.name ? info.wiki.name : null

  // No sidebar when not viewing a specific wiki
  if (!wikiName) {
    return null
  }

  const filteredNavGroups = useMemo(() => {
    return sidebarData.navGroups
      .map((group) => {
        // Filter and transform items based on permissions
        let filteredItems = group.items
          .filter((item) => {
            // Hide "New page" if user can't edit
            if (item.title === 'New page' && !permissions.edit) {
              return false
            }
            // Hide admin items if user can't manage
            if (item.title === 'Settings' && !permissions.manage) {
              return false
            }
            return true
          })
          .map((item) => {
            // Replace "Home" title with wiki name
            if (item.title === 'Home') {
              return { ...item, title: wikiName }
            }
            return item
          })

        // Add "All wikis" link at the start of Browse group
        if (group.title === 'Browse') {
          filteredItems = [
            { title: 'All wikis', url: getAppPath() || '/wiki', icon: Library, external: true },
            ...filteredItems,
          ]
        }

        return { ...group, items: filteredItems }
      })
      .filter((group) => group.items.length > 0) // Remove empty groups
  }, [permissions, wikiName])

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarContent className="pt-6">
        {filteredNavGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
