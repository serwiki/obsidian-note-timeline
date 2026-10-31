import {App, ItemView, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder, WorkspaceLeaf, moment, setIcon} from 'obsidian';
import {DateMatch, FORMATS, formatDate, localToday, parseNote} from './date-parser';

const VIEW = 'note-timeline-calendar';
type Scope = {type:'all'|'folder'|'file';path:string};
type Settings = {formats:string[];insertFormat:string;standaloneOnly:boolean;scope:Scope;previewLines:number;showModifications:boolean};
type Stored = {settings:Settings;activity:Record<string,string[]>};
type Indexed = {path:string;dates:DateMatch[];mtimeDay:string};
const DEFAULT:Settings={formats:['DD/MM/YYYY'],insertFormat:'DD/MM/YYYY',standaloneOnly:true,scope:{type:'all',path:''},previewLines:5,showModifications:true};
const compareFiles=(a:TAbstractFile,b:TAbstractFile)=>a instanceof TFolder&&!(b instanceof TFolder)?-1:b instanceof TFolder&&!(a instanceof TFolder)?1:a.name.localeCompare(b.name);
const dayOf=(ms:number)=>moment(ms).format('YYYY-MM-DD');

export default class NoteTimeline extends Plugin {
  settings:Settings={...DEFAULT};
  activity:Record<string,string[]>={};
  index=new Map<string,Indexed>();
  private saveTimer:number|null=null;
  private scanTimer=new Map<string,number>();
  private ready=false;

  async onload(){
    const saved=(await this.loadData()) as Partial<Stored>|null;
    this.settings={...DEFAULT,...saved?.settings,scope:{...DEFAULT.scope,...saved?.settings?.scope}};
    this.settings.previewLines=Math.max(1,Math.min(30,Math.round(Number(this.settings.previewLines)||5)));
    this.activity=saved?.activity??{};
    this.registerView(VIEW,leaf=>new CalendarView(leaf,this));
    this.addRibbonIcon('calendar-days','Open Note Timeline',()=>void this.openCalendar(false));
    this.addCommand({id:'open-calendar',name:'Open calendar in side panel',callback:()=>void this.openCalendar(false)});
    this.addCommand({id:'open-calendar-tab',name:'Open calendar in main tab',callback:()=>void this.openCalendar(true)});
    this.addCommand({id:'insert-date',name:'Insert current date',editorCallback:editor=>editor.replaceSelection(formatDate(new Date(),this.settings.insertFormat))});
    this.addSettingTab(new TimelineSettings(this.app,this));
    this.registerEvent(this.app.vault.on('modify',file=>{if(file instanceof TFile && file.extension==='md')this.scheduleIndex(file,true);}));
    this.registerEvent(this.app.vault.on('create',file=>{if(file instanceof TFile && file.extension==='md')this.scheduleIndex(file,true);}));
    this.registerEvent(this.app.vault.on('delete',file=>this.removeFile(file)));
    this.registerEvent(this.app.vault.on('rename',(file,old)=>this.renameFile(file,old)));
    this.app.workspace.onLayoutReady(()=>void this.rebuild());
  }
  onunload(){if(this.saveTimer!==null)window.clearTimeout(this.saveTimer);for(const t of this.scanTimer.values())window.clearTimeout(t);}
  private scheduleSave(){if(this.saveTimer!==null)window.clearTimeout(this.saveTimer);this.saveTimer=window.setTimeout(()=>{void this.saveData({settings:this.settings,activity:this.activity} as Stored);},450);}
  persist(){this.scheduleSave();this.refresh();}
  async rebuild(){this.index.clear();for(const file of this.app.vault.getMarkdownFiles())await this.indexFile(file,false);this.ready=true;this.refresh();}
  private scheduleIndex(file:TFile,record:boolean){const old=this.scanTimer.get(file.path);if(old!==undefined)window.clearTimeout(old);const path=file.path;this.scanTimer.set(path,window.setTimeout(()=>{this.scanTimer.delete(path);void this.indexFile(file,record);},400));}
  private async indexFile(file:TFile,record:boolean){
    try{
      const text=await this.app.vault.cachedRead(file);
      this.index.set(file.path,{path:file.path,dates:parseNote(text,this.settings.formats,this.settings.standaloneOnly),mtimeDay:dayOf(file.stat.mtime)});
      if(record&&this.ready){const day=localToday();const arr=this.activity[day]??[];if(!arr.includes(file.path)){this.activity[day]=[...arr,file.path];this.scheduleSave();}}
      this.refresh();
    }catch(e){console.warn('Note Timeline: unable to index',file.path,e);}
  }
  private removeFile(file:TAbstractFile){this.index.delete(file.path);this.refresh();}
  private renameFile(file:TAbstractFile,old:string){
    if(file instanceof TFile){const entry=this.index.get(old);if(entry){this.index.delete(old);this.index.set(file.path,{...entry,path:file.path});}}
    else if(file instanceof TFolder){for(const [path,entry] of [...this.index])if(path.startsWith(old+'/')){this.index.delete(path);this.index.set(file.path+path.slice(old.length),{...entry,path:file.path+path.slice(old.length)});}}
    const rewrite=(path:string)=>path===old?file.path:path.startsWith(old+'/')?file.path+path.slice(old.length):path;
    for(const [day,paths] of Object.entries(this.activity))this.activity[day]=[...new Set(paths.map(rewrite))];
    if(this.settings.scope.path===old||this.settings.scope.path.startsWith(old+'/'))this.settings.scope.path=rewrite(this.settings.scope.path);
    this.scheduleSave();this.refresh();
  }
  inScope(path:string){const {type,path:target}=this.settings.scope;return type==='all'||(type==='file'?path===target:path.startsWith(target+'/'));}
  entries(){return [...this.index.values()].filter(e=>this.inScope(e.path));}
  activityFor(day:string){return (this.activity[day]??[]).filter(path=>this.inScope(path));}
  refresh(){for(const leaf of this.app.workspace.getLeavesOfType(VIEW)){const view=leaf.view;if(view instanceof CalendarView)view.render();}}
  async openCalendar(tab:boolean){const leaf=tab?this.app.workspace.getLeaf('tab'):this.app.workspace.getRightLeaf(false);if(!leaf)return;await leaf.setViewState({type:VIEW,active:true});this.app.workspace.revealLeaf(leaf);}
  async openMatch(path:string,m:DateMatch){const file=this.app.vault.getAbstractFileByPath(path);if(!(file instanceof TFile))return;const leaf=this.app.workspace.getLeaf('tab');await leaf.openFile(file);const view=leaf.view;if(view instanceof MarkdownView){view.setEphemeralState({line:m.line});view.editor.setCursor({line:m.line,ch:0});view.editor.scrollIntoView({from:{line:m.line,ch:0},to:{line:m.line,ch:0}},true);}}
}

class CalendarView extends ItemView {
  plugin:NoteTimeline;
  month=moment().startOf('month');
  mode:'dates'|'edits'='dates';
  selected=localToday();
  private filterText='';
  private expandedFolders=new Set<string>();
  private treeOpen=false;
  constructor(leaf:WorkspaceLeaf,plugin:NoteTimeline){super(leaf);this.plugin=plugin;}
  getViewType(){return VIEW;}
  getDisplayText(){return 'Note Timeline';}
  getIcon(){return 'calendar-days';}
  async onOpen(){this.render();}
  private renderScopePicker(root:HTMLElement){
    const scope=this.plugin.settings.scope;
    const picker=root.createDiv({cls:'nt-scope'});
    const toggle=picker.createEl('button',{cls:'nt-scope-toggle',attr:{'aria-expanded':String(this.treeOpen)}});
    toggle.createSpan({text:scope.type==='all'?'All notes':scope.path.split('/').pop()||scope.path,cls:'nt-scope-name'});
    const detail=scope.type==='all'?'Entire vault':scope.path;
    toggle.setAttribute('title',detail);
    toggle.createSpan({text:this.treeOpen?'▴':'▾',cls:'nt-scope-chevron'});
    toggle.onclick=()=>{this.treeOpen=!this.treeOpen;this.render();};
    if(!this.treeOpen)return;
    const panel=picker.createDiv({cls:'nt-tree-panel'});
    const search=panel.createEl('input',{cls:'nt-tree-search',type:'search',placeholder:'Search folders or notes…',attr:{'aria-label':'Search folders or notes'}});
    search.value=this.filterText;
    const tree=panel.createDiv({cls:'nt-tree',attr:{role:'tree','aria-label':'Obsidian vault files'}});
    search.oninput=()=>{this.filterText=search.value;this.renderTree(tree);};
    this.renderTree(tree);
  }
  private renderTree(tree:HTMLElement){
    tree.empty();
    const q=this.filterText.trim().toLocaleLowerCase();
    const selected=this.plugin.settings.scope;
    const select=(scope:Scope)=>{this.plugin.settings.scope=scope;this.treeOpen=false;this.plugin.persist();};
    const node=(container:HTMLElement,name:string,path:string,type:'all'|'folder'|'file',level:number,expanded:boolean,hasChildren:boolean)=>{
      const row=container.createDiv({cls:'nt-tree-row',attr:{role:'treeitem','aria-level':String(level+1),'aria-selected':String(selected.type===type&&(type==='all'||selected.path===path))}});
      row.style.paddingInlineStart=`${8+level*15}px`;
      if(hasChildren){const exp=row.createEl('button',{cls:'nt-tree-expander',text:expanded?'▾':'▸',attr:{'aria-label':expanded?'Collapse folder':'Expand folder'}});exp.onclick=e=>{e.stopPropagation();if(this.expandedFolders.has(path))this.expandedFolders.delete(path);else this.expandedFolders.add(path);this.renderTree(tree);};}
      else row.createSpan({cls:'nt-tree-spacer'});
      // Obsidian standard Lucide icons, with native explorer-style indentation.
      const icon=row.createSpan({cls:'nt-tree-icon'});
      // Avoid requiring a separate icon library; obsidian supplies setIcon.
      setIcon(icon,type==='file'?'file-text':type==='all'?'layers':'folder');
      const label=row.createSpan({text:name,cls:'nt-tree-label'});label.setAttribute('title',path||'Entire vault');
      row.onclick=()=>select({type,path});
      return row;
    };
    node(tree,'All notes','', 'all',0,false,false);
    const roots=this.app.vault.getRoot().children;
    const hasMatch=(f:TAbstractFile):boolean=>{
      if(!q)return true;
      if(f.name.toLocaleLowerCase().includes(q)||f.path.toLocaleLowerCase().includes(q))return true;
      return f instanceof TFolder&&f.children.some(hasMatch);
    };
    const visit=(file:TAbstractFile,depth:number)=>{
      if(file instanceof TFile && file.extension!=='md')return;
      if(!hasMatch(file))return;
      if(file instanceof TFolder){
        const expanded=Boolean(q)||this.expandedFolders.has(file.path);
        node(tree,file.name,file.path,'folder',depth,expanded,file.children.length>0);
        if(expanded)for(const child of [...file.children].sort(compareFiles))visit(child,depth+1);
      }else if(file instanceof TFile){node(tree,file.basename,file.path,'file',depth,false,false);}
    };
    for(const f of [...roots].sort(compareFiles))visit(f,0);
  }
  render(){
    const root=this.contentEl;root.empty();root.addClass('nt-root');
    const header=root.createDiv({cls:'nt-header'});
    const prev=header.createEl('button',{text:'‹',attr:{'aria-label':'Previous month'}});
    header.createEl('strong',{text:this.month.format('MMMM YYYY')});
    const next=header.createEl('button',{text:'›',attr:{'aria-label':'Next month'}});
    prev.onclick=()=>{this.month.subtract(1,'month');this.render();};next.onclick=()=>{this.month.add(1,'month');this.render();};
    this.renderScopePicker(root);
    if(!this.plugin.settings.showModifications && this.mode==='edits')this.mode='dates';
    if(this.plugin.settings.showModifications){
      const modes=root.createDiv({cls:'nt-modes'});
      for(const [mode,label] of [['dates','Written dates'],['edits','Modifications']] as const){const b=modes.createEl('button',{text:label,cls:this.mode===mode?'is-active':''});b.onclick=()=>{this.mode=mode;this.render();};}
    }
    const calendar=root.createDiv({cls:'nt-calendar'});
    for(const d of ['M','T','W','T','F','S','S'])calendar.createEl('span',{text:d,cls:'nt-weekday'});
    const beginning=(this.month.isoWeekday()-1);
    for(let i=0;i<beginning;i++)calendar.createDiv({cls:'nt-empty'});
    const days=this.month.daysInMonth();
    for(let d=1;d<=days;d++){
      const date=this.month.clone().date(d).format('YYYY-MM-DD');
      const has=this.mode==='dates'?this.plugin.entries().some(e=>e.dates.some(m=>m.date===date)):this.plugin.activityFor(date).length>0||this.plugin.entries().some(e=>e.mtimeDay===date);
      const b=calendar.createEl('button',{text:String(d),cls:['nt-day',has?'has-data':'',date===this.selected?'is-selected':''].join(' ')});
      b.onclick=()=>{this.selected=date;this.render();};
    }
    const list=root.createDiv({cls:'nt-results'});
    list.createEl('h4',{text:moment(this.selected,'YYYY-MM-DD').format('DD/MM/YYYY')});
    if(this.mode==='dates'){
      const matches=this.plugin.entries().flatMap(e=>e.dates.filter(m=>m.date===this.selected).map(m=>({path:e.path,m})));
      if(!matches.length)list.createEl('p',{text:'No dated sections found.'});
      for(const {path,m} of matches){const card=list.createDiv({cls:'nt-card'});card.createEl('strong',{text:path});const preview=card.createEl('p',{text:m.excerpt,cls:'nt-preview'});preview.style.setProperty('--nt-preview-lines',String(this.plugin.settings.previewLines));const more=card.createEl('button',{text:'Expand preview',cls:'nt-expand'});more.onclick=()=>{const expanded=preview.classList.toggle('is-expanded');more.setText(expanded?'Collapse preview':'Expand preview');};const open=card.createEl('button',{text:'Open at date'});open.onclick=()=>void this.plugin.openMatch(path,m);}
    }else{
      const tracked=this.plugin.activityFor(this.selected);
      const historical=this.plugin.entries().filter(e=>e.mtimeDay===this.selected).map(e=>e.path);
      const paths=[...new Set([...tracked,...historical])];
      if(!paths.length)list.createEl('p',{text:'No recorded modifications or matching last-modified dates.'});
      for(const path of paths){const card=list.createDiv({cls:'nt-card'});card.createEl('strong',{text:path});card.createEl('p',{text:tracked.includes(path)?'Modification recorded by Note Timeline':'Last modified date from file metadata (not a full history)'});const file=this.app.vault.getAbstractFileByPath(path);if(file instanceof TFile){const b=card.createEl('button',{text:'Open note'});b.onclick=()=>void this.app.workspace.getLeaf('tab').openFile(file);}}
    }
  }
}

class TimelineSettings extends PluginSettingTab{
  plugin:NoteTimeline;
  constructor(app:App,plugin:NoteTimeline){super(app,plugin);this.plugin=plugin;}
  display(){
    const c=this.containerEl;c.empty();c.createEl('h2',{text:'Note Timeline settings'});
    new Setting(c).setName('Insert date format').setDesc('Used by the Insert current date command').addDropdown(d=>{for(const f of FORMATS)d.addOption(f,f);d.setValue(this.plugin.settings.insertFormat);d.onChange(async v=>{this.plugin.settings.insertFormat=v;this.plugin.persist();});});
    for(const format of FORMATS)new Setting(c).setName('Recognize '+format).addToggle(t=>t.setValue(this.plugin.settings.formats.includes(format)).onChange(async yes=>{const a=new Set(this.plugin.settings.formats);yes?a.add(format):a.delete(format);this.plugin.settings.formats=[...a];this.plugin.persist();await this.plugin.rebuild();}));
    new Setting(c).setName('Only dates on their own line').setDesc('Recommended: avoids confusing dates mentioned in ordinary text with class sessions. Markdown headings with dates are supported.').addToggle(t=>t.setValue(this.plugin.settings.standaloneOnly).onChange(async v=>{this.plugin.settings.standaloneOnly=v;this.plugin.persist();await this.plugin.rebuild();}));
    new Setting(c).setName('Preview length (lines)').setDesc('Number of lines shown before expanding a dated fragment.').addSlider(sl=>sl.setLimits(1,30,1).setValue(this.plugin.settings.previewLines).setDynamicTooltip().onChange(v=>{this.plugin.settings.previewLines=v;this.plugin.persist();}));
    new Setting(c).setName('Show Modifications tab').setDesc('Hide the Modifications tab when you only want to browse dates written in notes. Existing activity history is preserved.').addToggle(t=>t.setValue(this.plugin.settings.showModifications).onChange(v=>{this.plugin.settings.showModifications=v;this.plugin.persist();}));
    new Setting(c).setName('Rebuild date index').setDesc('Rescan all Markdown notes without changing their content').addButton(b=>b.setButtonText('Rebuild').onClick(async()=>{await this.plugin.rebuild();new Notice('Note Timeline index rebuilt');}));
  }
}
