# Mochi wiki app
# Copyright Alistair Cunningham 2025

# Database creation

def database_create(db):
    db.exec("create table pages (id text primary key, page text not null unique, title text not null, content text not null, author text not null, created integer not null, updated integer not null, version integer not null default 1, deleted integer not null default 0)")
    db.exec("create table revisions (id text primary key, page text not null references pages(id), content text not null, title text not null, author text not null, created integer not null, version integer not null, comment text not null default '')")
    db.exec("create table tags (page text not null references pages(id), tag text not null, primary key (page, tag))")
    db.exec("create table redirects (source text primary key, target text not null, created integer not null)")
    db.exec("create table settings (name text primary key, value text not null)")
    db.exec("create index pages_updated on pages(updated)")
    db.exec("create index pages_author on pages(author)")
    db.exec("create index revisions_page on revisions(page)")
    db.exec("create index revisions_created on revisions(created)")
    db.exec("create index tags_tag on tags(tag)")
    db.exec("insert into settings (name, value) values ('home', 'home')")

# Stub actions (to be implemented in later stages)

def action_page(a):
    a.error(501, "Not implemented")

def action_page_edit(a):
    a.error(501, "Not implemented")

def action_page_history(a):
    a.error(501, "Not implemented")

def action_new(a):
    a.error(501, "Not implemented")

def action_search(a):
    a.error(501, "Not implemented")

def action_settings(a):
    a.error(501, "Not implemented")

# Stub event handlers (to be implemented in later stages)

def event_page_create(e):
    pass

def event_page_update(e):
    pass

def event_page_delete(e):
    pass

def event_redirect_set(e):
    pass

def event_redirect_delete(e):
    pass

def event_tag_add(e):
    pass

def event_tag_remove(e):
    pass

def event_setting_set(e):
    pass
